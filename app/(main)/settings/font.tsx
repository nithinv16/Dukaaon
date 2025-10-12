import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, RadioButton, IconButton, Divider, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../../store/settings';
import { useTranslation } from '../../../contexts/LanguageContext';

type FontFamily = 'default' | 'roboto' | 'open-sans' | 'lato';
type FontSize = 'small' | 'medium' | 'large';

interface FontOption {
  value: FontFamily;
  label: string;
  style?: any;
}

interface SizeOption {
  value: FontSize;
  label: string;
  sampleSize: number;
}

export default function FontSettings() {
  const router = useRouter();
  const { fontFamily, fontSize, setFontFamily, setFontSize } = useSettingsStore();
  const { t } = useTranslation();

  const fontOptions: FontOption[] = [
    { value: 'default', label: t('font.default_system') },
    { value: 'roboto', label: 'Roboto', style: { fontFamily: 'Roboto' } },
    { value: 'open-sans', label: 'Open Sans', style: { fontFamily: 'OpenSans' } },
    { value: 'lato', label: 'Lato', style: { fontFamily: 'Lato' } },
  ];

  const sizeOptions: SizeOption[] = [
    { value: 'small', label: t('font.small'), sampleSize: 14 },
    { value: 'medium', label: t('font.medium'), sampleSize: 16 },
    { value: 'large', label: t('font.large'), sampleSize: 18 },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>{t('font.title')}</Text>
        <View style={{width: 40}} />
      </View>
      
      <ScrollView style={styles.container}>
        <Text style={styles.description}>
          {t('font.description')}
        </Text>
        
        <Text style={styles.sectionTitle}>{t('font.font_family')}</Text>
        <RadioButton.Group 
          onValueChange={value => setFontFamily(value as FontFamily)} 
          value={fontFamily}
        >
          {fontOptions.map((font) => (
            <List.Item
              key={font.value}
              title={() => (
                <Text style={font.style}>{font.label}</Text>
              )}
              left={props => <List.Icon {...props} icon="format-font" />}
              right={() => (
                <RadioButton
                  value={font.value}
                  color="#FF7D00"
                />
              )}
              onPress={() => setFontFamily(font.value)}
              style={styles.fontItem}
            />
          ))}
        </RadioButton.Group>
        
        <Divider style={styles.divider} />
        
        <Text style={styles.sectionTitle}>{t('font.font_size')}</Text>
        <RadioButton.Group 
          onValueChange={value => setFontSize(value as FontSize)} 
          value={fontSize}
        >
          {sizeOptions.map((size) => (
            <List.Item
              key={size.value}
              title={() => (
                <Text style={{ fontSize: size.sampleSize }}>{size.label}</Text>
              )}
              left={props => <List.Icon {...props} icon="format-size" />}
              right={() => (
                <RadioButton
                  value={size.value}
                  color="#FF7D00"
                />
              )}
              onPress={() => setFontSize(size.value)}
              style={styles.fontItem}
            />
          ))}
        </RadioButton.Group>
        
        <Card style={styles.previewCard}>
          <Card.Content>
            <Text style={styles.previewTitle}>{t('font.preview')}</Text>
            <Text style={[
              styles.previewText,
              getFontStyle(fontFamily),
              { fontSize: getFontSize(fontSize) }
            ]}>
              {t('font.preview_text')}
            </Text>
          </Card.Content>
        </Card>
        
        <Text style={styles.note}>
          {t('font.restart_note')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper functions to get font styles based on settings
function getFontStyle(family: FontFamily) {
  switch (family) {
    case 'roboto':
      return { fontFamily: 'Roboto' };
    case 'open-sans':
      return { fontFamily: 'OpenSans' };
    case 'lato':
      return { fontFamily: 'Lato' };
    default:
      return {};
  }
}

function getFontSize(size: FontSize) {
  switch (size) {
    case 'small':
      return 14;
    case 'medium':
      return 16;
    case 'large':
      return 18;
    default:
      return 16;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  description: {
    marginBottom: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  fontItem: {
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 16,
  },
  previewCard: {
    marginTop: 24,
    marginBottom: 16,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  previewText: {
    lineHeight: 22,
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});