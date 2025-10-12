import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{width: 40}} />
      </View>
      
      <ScrollView style={styles.container}>
        <Text style={styles.lastUpdated}>Last Updated: March 25, 2024</Text>
        
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Dukaaon ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
        </Text>
        
        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.subSectionTitle}>2.1 Personal Information</Text>
        <Text style={styles.bulletPoint}>• Name and contact information</Text>
        <Text style={styles.bulletPoint}>• Phone number</Text>
        <Text style={styles.bulletPoint}>• Email address</Text>
        <Text style={styles.bulletPoint}>• Business details</Text>
        <Text style={styles.bulletPoint}>• Location data</Text>
        <Text style={styles.bulletPoint}>• Profile information</Text>
        <Text style={styles.bulletPoint}>• KYC documents</Text>
        
        <Text style={styles.subSectionTitle}>2.2 Usage Information</Text>
        <Text style={styles.bulletPoint}>• Device information</Text>
        <Text style={styles.bulletPoint}>• IP address</Text>
        <Text style={styles.bulletPoint}>• App usage statistics</Text>
        <Text style={styles.bulletPoint}>• Transaction history</Text>
        <Text style={styles.bulletPoint}>• Search queries</Text>
        <Text style={styles.bulletPoint}>• Location data</Text>
        
        <Text style={styles.subSectionTitle}>2.3 Payment Information</Text>
        <Text style={styles.bulletPoint}>• Payment method details</Text>
        <Text style={styles.bulletPoint}>• Transaction history</Text>
        <Text style={styles.bulletPoint}>• Bank account information (for sellers)</Text>
        
        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.subSectionTitle}>3.1 Primary Uses</Text>
        <Text style={styles.bulletPoint}>• Account creation and management</Text>
        <Text style={styles.bulletPoint}>• Order processing and delivery</Text>
        <Text style={styles.bulletPoint}>• Payment processing</Text>
        <Text style={styles.bulletPoint}>• Location-based services</Text>
        <Text style={styles.bulletPoint}>• Customer support</Text>
        <Text style={styles.bulletPoint}>• Business verification</Text>
        
        <Text style={styles.subSectionTitle}>3.2 Secondary Uses</Text>
        <Text style={styles.bulletPoint}>• Analytics and improvement</Text>
        <Text style={styles.bulletPoint}>• Marketing communications</Text>
        <Text style={styles.bulletPoint}>• Fraud prevention</Text>
        <Text style={styles.bulletPoint}>• Legal compliance</Text>
        
        <Text style={styles.sectionTitle}>4. Data Protection</Text>
        <Text style={styles.paragraph}>
          We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction or damage.
        </Text>
        
        <Text style={styles.sectionTitle}>5. Data Sharing</Text>
        <Text style={styles.paragraph}>
          We may share your information with third-party service providers, business partners, and regulatory authorities as necessary to provide our services and comply with legal obligations.
        </Text>
        
        <Text style={styles.sectionTitle}>6. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to access, correct, update, or request deletion of your personal information. You can also object to processing or request restriction of processing in certain circumstances.
        </Text>
        
        <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          Our services are not intended for children under 13. We do not knowingly collect personal information from children under 13.
        </Text>
        
        <Text style={styles.sectionTitle}>8. Changes to Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy periodically. We will notify you of any changes by posting the new Privacy Policy on this page.
        </Text>
        
        <Text style={styles.sectionTitle}>9. Contact Us</Text>
        <Text style={styles.paragraph}>
          For privacy-related queries, contact us at:
        </Text>
        <Text style={styles.contactInfo}>Email: support@dukaaon.in</Text>
        <Text style={styles.contactInfo}>Website: www.dukaaon.in</Text>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
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
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    color: '#333',
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#444',
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 24,
    color: '#444',
    marginBottom: 6,
    marginLeft: 12,
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 24,
    color: '#2196F3',
    marginLeft: 12,
  },
  bottomPadding: {
    height: 60,
  },
}); 