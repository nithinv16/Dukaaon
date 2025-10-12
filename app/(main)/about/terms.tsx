import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsOfService() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{width: 40}} />
      </View>
      
      <ScrollView style={styles.container}>
        <Text style={styles.lastUpdated}>Last Updated: May 10, 2023</Text>
        
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to DukaaOn ("we," "our," or "us"). These Terms of Service ("Terms") govern your use of the DukaaOn mobile application, website, and services (collectively, the "Service").
        </Text>
        <Text style={styles.paragraph}>
          By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.
        </Text>
        
        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.paragraph}>
          You must be at least 18 years old and capable of forming a binding contract to use our Service. By using our Service, you represent and warrant that you meet these requirements.
        </Text>
        
        <Text style={styles.sectionTitle}>3. User Accounts</Text>
        <Text style={styles.paragraph}>
          When you create an account with us, you must provide accurate, complete, and current information. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
        </Text>
        <Text style={styles.paragraph}>
          You are responsible for safeguarding the password used to access the Service and for any activities or actions under your password.
        </Text>
        
        <Text style={styles.sectionTitle}>4. Acceptable Use</Text>
        <Text style={styles.paragraph}>
          You agree not to use the Service:
        </Text>
        <Text style={styles.bulletPoint}>• In any way that violates any applicable laws or regulations.</Text>
        <Text style={styles.bulletPoint}>• To impersonate or attempt to impersonate any person or entity.</Text>
        <Text style={styles.bulletPoint}>• To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Service.</Text>
        <Text style={styles.bulletPoint}>• To attempt to gain unauthorized access to any portion of the Service.</Text>
        
        <Text style={styles.sectionTitle}>5. User Content</Text>
        <Text style={styles.paragraph}>
          Our Service allows you to post, link, store, share, and otherwise make available certain information, text, graphics, or other material ("Content"). You are responsible for the Content that you post on or through the Service, including its legality, reliability, and appropriateness.
        </Text>
        
        <Text style={styles.sectionTitle}>6. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of DukaaOn and its licensors.
        </Text>
        
        <Text style={styles.sectionTitle}>7. Fees and Payment</Text>
        <Text style={styles.paragraph}>
          Some features of the Service may require payment of fees. You agree to pay all fees associated with the Service as outlined at the time of purchase.
        </Text>
        <Text style={styles.paragraph}>
          All fees are exclusive of all taxes, levies, or duties imposed by taxing authorities, and you shall be responsible for payment of all such taxes, levies, or duties.
        </Text>
        
        <Text style={styles.sectionTitle}>8. Termination</Text>
        <Text style={styles.paragraph}>
          We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including without limitation if you breach the Terms.
        </Text>
        <Text style={styles.paragraph}>
          Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service.
        </Text>
        
        <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          In no event shall DukaaOn, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
        </Text>
        <Text style={styles.bulletPoint}>• Your access to or use of or inability to access or use the Service.</Text>
        <Text style={styles.bulletPoint}>• Any conduct or content of any third party on the Service.</Text>
        <Text style={styles.bulletPoint}>• Any content obtained from the Service.</Text>
        <Text style={styles.bulletPoint}>• Unauthorized access, use, or alteration of your transmissions or content.</Text>
        
        <Text style={styles.sectionTitle}>10. Governing Law</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.
        </Text>
        
        <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice prior to any new terms taking effect.
        </Text>
        <Text style={styles.paragraph}>
          By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised Terms.
        </Text>
        
        <Text style={styles.sectionTitle}>12. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at:
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