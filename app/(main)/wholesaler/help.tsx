import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, BackHandler } from 'react-native';
import { Text, Card, Button, IconButton, List, Divider, Searchbar, Avatar, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WHOLESALER_COLORS } from '../../../constants/colors';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export default function WholesalerHelp() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [translations, setTranslations] = useState({
    helpSupport: 'Help & Support',
    searchFAQs: 'Search FAQs...',
    allCategories: 'All Categories',
    inventory: 'Inventory',
    delivery: 'Delivery',
    customers: 'Customers',
    analytics: 'Analytics',
    orders: 'Orders',
    account: 'Account',
    contactSupport: 'Contact Support',
    emailSupport: 'Email Support',
    whatsappSupport: 'WhatsApp Support',
    callSupport: 'Call Support',
    frequentlyAskedQuestions: 'Frequently Asked Questions',
    needMoreHelp: 'Need More Help?',
    getInTouch: 'Get in touch with our support team',
    supportEmail: 'support@dukaaon.com',
    supportPhone: '+91 80896 68552'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return;
      
      try {
        const results = await Promise.all(
          Object.values(translations).map(value => translationService.translateText(value, currentLanguage))
        );
        
        const keys = Object.keys(translations);
        const newTranslations = keys.reduce((acc, key, index) => {
          acc[key] = results[index].translatedText;
          return acc;
        }, {} as typeof translations);
        
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Handle back button navigation for wholesaler help screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate back to the previous screen instead of exiting the app
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      } else {
        // If we can't go back, navigate to wholesaler home screen
        router.replace('/(main)/wholesaler');
        return true; // Prevent default behavior
      }
    });

    return () => backHandler.remove();
  }, [router]);

  const faqs: FAQItem[] = [
    {
      question: "How do I add products to my inventory?",
      answer: "To add products to your inventory, go to the 'Quick Actions' section on your home screen and tap 'Add Product'. Fill in the product details including name, category, price, and quantity. You can also add product images to make them more appealing to retailers.",
      category: "Inventory"
    },
    {
      question: "How do I update product prices?",
      answer: "To update product prices, go to 'Inventory', find the product you want to update, and tap on it. Then tap the 'Edit' button and update the price field. Don't forget to save your changes.",
      category: "Inventory"
    },
    {
      question: "How do I book a delivery?",
      answer: "To book a delivery, tap on 'Book Delivery' in the Quick Actions section. You can select a retailer from your customer list or enter details manually. Set the delivery date and time, add any notes, and confirm the booking.",
      category: "Delivery"
    },
    {
      question: "How do I track my deliveries?",
      answer: "You can track all your deliveries from the 'Booked Deliveries' section on your home screen or by going to the 'Deliveries' page. Each delivery shows its current status (pending, in transit, delivered, or cancelled).",
      category: "Delivery"
    },
    {
      question: "How do I update a delivery status?",
      answer: "To update a delivery status, open the delivery details by tapping on it in your deliveries list. Then use the status controls to mark it as 'In Transit' or 'Delivered' as appropriate.",
      category: "Delivery"
    },
    {
      question: "How do I view my customers?",
      answer: "To view your customers, tap on 'Customers' in the Quick Actions section. This will show you a list of all retailers who have purchased from you or whom you've added manually.",
      category: "Customers"
    },
    {
      question: "How do I view my sales analytics?",
      answer: "To view your sales analytics, tap on 'Analytics' in the Quick Actions section. This will show you key metrics like total sales, popular products, and sales trends over time.",
      category: "Analytics"
    },
    {
      question: "How do I manage my orders?",
      answer: "To manage your orders, tap on 'Orders' in the Quick Actions section. You can view all incoming orders, accept or reject them, and track their fulfillment status.",
      category: "Orders"
    },
    {
      question: "How do I update my business profile?",
      answer: "To update your business profile, go to the Settings page by tapping your profile icon in the top-right corner of the home screen. From there, you can edit your business details, contact information, and location.",
      category: "Account"
    },
    {
      question: "How do I get verified as a wholesaler?",
      answer: "To get verified, ensure your business details are complete in your profile. Then submit verification documents when prompted. Our team will review your information and update your verification status within 2-3 business days.",
      category: "Account"
    }
  ];

  const categories = [...new Set(faqs.map(faq => faq.category))];

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? faq.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const toggleFAQ = (question: string) => {
    setExpandedFAQ(expandedFAQ === question ? null : question);
  };

  const contactSupport = () => {
    Linking.openURL('mailto:support@dukaaon.com?subject=Wholesaler%20Support%20Request');
  };

  const openWhatsapp = () => {
    Linking.openURL('https://wa.me/918089668552');
  };

  const callSupport = () => {
    Linking.openURL('tel:+918089668552');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          onPress={() => router.back()} 
          iconColor={WHOLESALER_COLORS.background} 
          size={24}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>{translations.helpSupport}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Search Bar */}
        <Searchbar
          placeholder={translations.searchFAQs}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        {/* Category Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          <Chip 
            mode="outlined" 
            selected={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
            style={styles.categoryChip}
          >
            {translations.allCategories}
          </Chip>
          {categories.map(category => (
            <Chip 
              key={category}
              mode="outlined"
              selected={selectedCategory === category}
              onPress={() => setSelectedCategory(category)}
              style={styles.categoryChip}
            >
              {translations[category.toLowerCase() as keyof typeof translations] || category}
            </Chip>
          ))}
        </ScrollView>

        {/* Quick Help Cards */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Quick Help</Text>
        <View style={styles.quickHelpGrid}>
          <Card style={styles.quickHelpCard} onPress={() => setSelectedCategory("Inventory")}>
            <Card.Content style={styles.quickHelpContent}>
              <MaterialCommunityIcons name="package-variant" size={32} color={WHOLESALER_COLORS.primary} />
              <Text variant="titleSmall" style={styles.quickHelpTitle}>Inventory Management</Text>
            </Card.Content>
          </Card>
          
          <Card style={styles.quickHelpCard} onPress={() => setSelectedCategory("Delivery")}>
            <Card.Content style={styles.quickHelpContent}>
              <MaterialCommunityIcons name="truck-delivery" size={32} color={WHOLESALER_COLORS.secondary} />
              <Text variant="titleSmall" style={styles.quickHelpTitle}>Deliveries</Text>
            </Card.Content>
          </Card>
          
          <Card style={styles.quickHelpCard} onPress={() => setSelectedCategory("Orders")}>
            <Card.Content style={styles.quickHelpContent}>
              <MaterialCommunityIcons name="clipboard-list" size={32} color={WHOLESALER_COLORS.success} />
              <Text variant="titleSmall" style={styles.quickHelpTitle}>Orders</Text>
            </Card.Content>
          </Card>
          
          <Card style={styles.quickHelpCard} onPress={() => setSelectedCategory("Account")}>
            <Card.Content style={styles.quickHelpContent}>
              <MaterialCommunityIcons name="account-cog" size={32} color={WHOLESALER_COLORS.headerBg} />
              <Text variant="titleSmall" style={styles.quickHelpTitle}>Account</Text>
            </Card.Content>
          </Card>
        </View>

        {/* FAQs */}
        <Text variant="titleMedium" style={styles.sectionTitle}>{translations.frequentlyAskedQuestions}</Text>
        <Card style={styles.faqCard}>
          <Card.Content>
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map((faq, index) => (
                <React.Fragment key={faq.question}>
                  <List.Accordion
                    title={faq.question}
                    expanded={expandedFAQ === faq.question}
                    onPress={() => toggleFAQ(faq.question)}
                    titleStyle={styles.faqQuestion}
                    style={styles.faqAccordion}
                    left={props => <List.Icon {...props} icon="help-circle" color={WHOLESALER_COLORS.primary} />}
                  >
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </List.Accordion>
                  {index < filteredFAQs.length - 1 && <Divider />}
                </React.Fragment>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="magnify-close" size={48} color={WHOLESALER_COLORS.mediumGrey} />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try a different search term or category</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Contact Support */}
        <Text variant="titleMedium" style={styles.sectionTitle}>{translations.contactSupport}</Text>
        <Card style={styles.supportCard}>
          <Card.Content>
            <View style={styles.supportHeader}>
              <Avatar.Icon size={48} icon="headset" style={styles.supportIcon} />
              <View style={styles.supportInfo}>
                <Text variant="titleMedium">{translations.needMoreHelp}</Text>
                <Text variant="bodyMedium" style={styles.supportSubtext}>
                  {translations.getInTouch}
                </Text>
              </View>
            </View>
            
            <View style={styles.supportButtons}>
              <Button 
                mode="contained" 
                icon="email"
                onPress={contactSupport}
                style={[styles.supportButton, styles.emailButton]}
              >
                {translations.emailSupport}
              </Button>
              
              <Button 
                mode="contained" 
                icon="whatsapp"
                onPress={openWhatsapp}
                style={[styles.supportButton, styles.whatsappButton]}
              >
                {translations.whatsappSupport}
              </Button>
              
              <Button 
                mode="contained" 
                icon="phone"
                onPress={callSupport}
                style={[styles.supportButton, styles.callButton]}
              >
                {translations.callSupport}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Video Tutorials */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Video Tutorials</Text>
        <Card style={styles.tutorialsCard}>
          <Card.Content>
            <List.Item
              title="Getting Started with Dukaaon"
              description="Learn the basics of using the Dukaaon app as a wholesaler"
              left={props => <List.Icon {...props} icon="play-circle" color={WHOLESALER_COLORS.primary} />}
              onPress={() => {}}
              style={styles.tutorialItem}
            />
            <Divider />
            <List.Item
              title="Managing Your Inventory"
              description="How to add, edit, and organize your product inventory"
              left={props => <List.Icon {...props} icon="play-circle" color={WHOLESALER_COLORS.primary} />}
              onPress={() => {}}
              style={styles.tutorialItem}
            />
            <Divider />
            <List.Item
              title="Handling Orders & Deliveries"
              description="Process orders and manage deliveries efficiently"
              left={props => <List.Icon {...props} icon="play-circle" color={WHOLESALER_COLORS.primary} />}
              onPress={() => {}}
              style={styles.tutorialItem}
            />
          </Card.Content>
        </Card>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>dukaaOn Wholesaler App v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 0,
    backgroundColor: WHOLESALER_COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: WHOLESALER_COLORS.lightGrey,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: WHOLESALER_COLORS.background,
  },
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: WHOLESALER_COLORS.background,
    elevation: 2,
  },
  categoryContainer: {
    paddingBottom: 16,
    flexDirection: 'row',
  },
  categoryChip: {
    marginRight: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  quickHelpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickHelpCard: {
    width: '48%',
    marginBottom: 12,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  quickHelpContent: {
    alignItems: 'center',
    padding: 16,
  },
  quickHelpTitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  faqCard: {
    marginBottom: 24,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  faqAccordion: {
    backgroundColor: WHOLESALER_COLORS.background,
    paddingLeft: 0,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '500',
  },
  faqAnswer: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
    color: WHOLESALER_COLORS.darkGrey,
    lineHeight: 20,
  },
  supportCard: {
    marginBottom: 24,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  supportHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  supportIcon: {
    backgroundColor: WHOLESALER_COLORS.primaryLight,
  },
  supportInfo: {
    marginLeft: 16,
    flex: 1,
  },
  supportSubtext: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginTop: 4,
  },
  supportButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  supportButton: {
    marginBottom: 8,
  },
  emailButton: {
    backgroundColor: WHOLESALER_COLORS.primary,
  },
  whatsappButton: {
    backgroundColor: '#25D366', // WhatsApp green
  },
  callButton: {
    backgroundColor: WHOLESALER_COLORS.secondary,
  },
  tutorialsCard: {
    marginBottom: 24,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  tutorialItem: {
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  emptySubtext: {
    marginTop: 8,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  versionContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  versionText: {
    color: WHOLESALER_COLORS.mediumGrey,
    fontSize: 12,
  },
});
