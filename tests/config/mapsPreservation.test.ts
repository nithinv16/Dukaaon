/**
 * Preservation test — Google Maps API key after relocation to config.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 22.2)
 * Property 2: Preservation — Maps after key relocation
 *
 * **Validates: Requirements 3.11**
 *
 * This is a static verification. We cannot run actual maps, geocoding or place
 * lookups in a Jest environment, but we CAN verify the wiring chain is intact:
 *
 *   .env  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 *       ↓
 *   app.config.js  extra.googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 *       ↓
 *   constants/config.ts  GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey
 *
 * And that no component reading GOOGLE_MAPS_API_KEY has changed its import path.
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Maps API key preservation after relocation (Requirement 3.11)', () => {
  const TEST_API_KEY = 'AIzaSyC1-TEST-KEY-FOR-VERIFICATION';

  beforeAll(() => {
    // Set the env var that app.config.js reads
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_API_KEY;
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  describe('config wiring chain', () => {
    it('constants/config.ts exports GOOGLE_MAPS_API_KEY sourced from extra.googleMapsApiKey', () => {
      // Mock expo-constants to simulate runtime behavior
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              googleMapsApiKey: TEST_API_KEY,
            },
          },
        },
      }));

      const config = require('../../constants/config');
      expect(config.GOOGLE_MAPS_API_KEY).toBe(TEST_API_KEY);
    });

    it('GOOGLE_MAPS_API_KEY is a named export (not default)', () => {
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              googleMapsApiKey: TEST_API_KEY,
            },
          },
        },
      }));

      const config = require('../../constants/config');
      // Verify it's a named export
      expect('GOOGLE_MAPS_API_KEY' in config).toBe(true);
      // Verify it's a string type
      expect(typeof config.GOOGLE_MAPS_API_KEY).toBe('string');
    });

    it('GOOGLE_MAPS_API_KEY resolves to empty string when extra is missing (graceful fallback)', () => {
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: null,
        },
      }));

      const config = require('../../constants/config');
      expect(config.GOOGLE_MAPS_API_KEY).toBe('');
    });

    it('app.config.js passes googleMapsApiKey in extra section from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', () => {
      // Read app.config.js source to statically verify the wiring
      const appConfigSource = fs.readFileSync(
        path.join(PROJECT_ROOT, 'app.config.js'),
        'utf-8'
      );

      // Verify the extra section contains googleMapsApiKey wired to the env var
      expect(appConfigSource).toContain('googleMapsApiKey');
      expect(appConfigSource).toContain('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
    });

    it('.env has EXPO_PUBLIC_GOOGLE_MAPS_API_KEY set', () => {
      const envPath = path.join(PROJECT_ROOT, '.env');
      if (!fs.existsSync(envPath)) {
        // .env might not exist in CI — skip gracefully
        console.warn('.env file not found; skipping env presence check');
        return;
      }
      const envContent = fs.readFileSync(envPath, 'utf-8');
      expect(envContent).toMatch(/^EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=.+/m);
    });
  });

  describe('consumer integrity — no component that uses GOOGLE_MAPS_API_KEY has broken', () => {
    it('GooglePlacesAutocomplete reads from process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', () => {
      const filePath = path.join(
        PROJECT_ROOT,
        'components/common/GooglePlacesAutocomplete.tsx'
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const source = fs.readFileSync(filePath, 'utf-8');
      // Verify it reads from the env var (either directly or via config)
      expect(source).toMatch(/EXPO_PUBLIC_GOOGLE_MAPS_API_KEY|constants\/config/);
    });

    it('distanceCalculation.ts reads from process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', () => {
      const filePath = path.join(PROJECT_ROOT, 'utils/distanceCalculation.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const source = fs.readFileSync(filePath, 'utf-8');
      expect(source).toMatch(/EXPO_PUBLIC_GOOGLE_MAPS_API_KEY|constants\/config/);
    });

    it('app.config.js still provides googleMaps.apiKey for Android native maps', () => {
      const appConfigSource = fs.readFileSync(
        path.join(PROJECT_ROOT, 'app.config.js'),
        'utf-8'
      );
      // The Android native maps config must still be present
      expect(appConfigSource).toContain('googleMaps');
      expect(appConfigSource).toMatch(/apiKey.*GOOGLE_MAPS_API_KEY/);
    });
  });

  describe('export structure verification', () => {
    it('constants/config.ts exports the expected set of config symbols', () => {
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              googleMapsApiKey: TEST_API_KEY,
              supabaseUrl: 'https://test.supabase.co',
              supabaseAnonKey: 'test-anon-key',
            },
          },
        },
      }));

      const config = require('../../constants/config');
      // Verify the key exports still exist
      expect(config).toHaveProperty('GOOGLE_MAPS_API_KEY');
      expect(config).toHaveProperty('SUPABASE_CONFIG');
      expect(config).toHaveProperty('FIREBASE_CONFIG');
      expect(config).toHaveProperty('APP_VERSION');
    });
  });
});
