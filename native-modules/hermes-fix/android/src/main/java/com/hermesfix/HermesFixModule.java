
package com.hermesfix;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = HermesFixModule.NAME)
public class HermesFixModule extends ReactContextBaseJavaModule {
    public static final String NAME = "HermesFix";

    public HermesFixModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public void installGlobalRequire() {
        // Method to trigger JS evaluation
        // The actual fix is in the JS code that loads this module
    }
}
