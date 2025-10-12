import React from 'react';
import { SafeAreaView } from 'react-native';
import TranslationTest from '../../components/test/TranslationTest';

export default function TestTranslationPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TranslationTest />
    </SafeAreaView>
  );
}