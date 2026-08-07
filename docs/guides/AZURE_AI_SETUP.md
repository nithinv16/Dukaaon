# Azure AI Integration Setup Guide

This guide explains how to set up and use the Azure AI features in the Dukaaon e-commerce app, including speech-to-text, text-to-speech, and translation capabilities.

## 🚀 Features Implemented

### 1. Speech-to-Text (Voice Search)
- **Regional Language Support**: Hindi, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Bengali, Punjabi, Odia, Assamese, Urdu, and English
- **Intent Recognition**: Automatically detects search, order, and navigation intents
- **Real-time Recognition**: Continuous speech recognition with live feedback
- **Voice Commands**: Users can search products, place orders, and navigate using voice

### 2. Text-to-Speech (Voice Responses)
- **Neural Voices**: High-quality neural voices for all supported languages
- **Contextual Responses**: Provides audio feedback for search results and actions
- **Language-specific Voices**: Native speakers for each regional language

### 3. Translation Services
- **Real-time Translation**: Translate app interface to user's preferred language
- **Search Query Translation**: Automatically translate voice searches to English for processing
- **Batch Translation**: Efficient translation of app content
- **Language Detection**: Automatic detection of spoken/written language

### 4. Multi-language App Interface
- **Dynamic Language Switching**: Change app language on-the-fly
- **Cached Translations**: Offline support with cached translations
- **Regional Language Support**: Full interface translation for Indian languages

## 📋 Prerequisites

### Azure Services Required
1. **Azure OpenAI Service** (for image generation and text processing)
2. **Azure Speech Services** (for speech-to-text and text-to-speech)
3. **Azure Translator** (for text translation)

### Development Environment
- React Native / Expo development environment
- Node.js 16+ 
- Azure subscription with Cognitive Services enabled

## 🛠️ Installation

### 1. Install Dependencies

```bash
# Using npm
npm install microsoft-cognitiveservices-speech-sdk @azure/openai @azure/ai-translation-text @react-native-async-storage/async-storage

# Using yarn
yarn add microsoft-cognitiveservices-speech-sdk @azure/openai @azure/ai-translation-text @react-native-async-storage/async-storage

# Using Expo
expo install microsoft-cognitiveservices-speech-sdk @azure/openai @azure/ai-translation-text @react-native-async-storage/async-storage
```

### 2. Environment Configuration

Create or update your `.env` file with Azure credentials:

```env
# Azure OpenAI
EXPO_PUBLIC_AZURE_OPENAI_API_KEY=your_openai_api_key_here
EXPO_PUBLIC_AZURE_OPENAI_RESOURCE_NAME=your_resource_name_here
EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Azure Speech Services
EXPO_PUBLIC_AZURE_SPEECH_KEY=your_speech_api_key_here
EXPO_PUBLIC_AZURE_SPEECH_REGION=eastus

# Azure Translator
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=your_translator_api_key_here
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=eastus
EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
```

### 3. Permissions Setup

#### Android (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

#### iOS (ios/YourApp/Info.plist)
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to microphone for voice search functionality</string>
<key>NSInternetUsageDescription</key>
<string>This app needs internet access for translation and speech services</string>
```

## 🔧 Azure Services Setup

### 1. Azure Speech Services

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new **Speech Services** resource
3. Choose your subscription and resource group
4. Select region (recommended: East US, West Europe, or Southeast Asia)
5. Choose pricing tier (F0 for free tier, S0 for standard)
6. Copy the **Key** and **Region** to your `.env` file

### 2. Azure Translator

1. Create a new **Translator** resource in Azure Portal
2. Choose the same region as Speech Services for better performance
3. Copy the **Key**, **Region**, and **Endpoint** to your `.env` file

### 3. Azure OpenAI (Optional - for image generation)

1. Apply for Azure OpenAI access (if not already approved)
2. Create an **Azure OpenAI** resource
3. Deploy a model (GPT-4 recommended)
4. Copy the **API Key**, **Resource Name**, and **Deployment Name**

## 🎯 Usage Examples

### 1. Voice Search Integration

```tsx
import VoiceSearch from '../components/common/VoiceSearch';

function SearchScreen() {
  const handleVoiceSearch = (query: string, intent?: string, entities?: any) => {
    console.log('Voice search:', query);
    // Handle search logic
  };

  const handleVoiceOrder = (productName: string, quantity?: number) => {
    console.log('Voice order:', productName, quantity);
    // Handle order logic
  };

  return (
    <VoiceSearch
      onSearchResult={handleVoiceSearch}
      onOrderResult={handleVoiceOrder}
      selectedLanguage="hi-IN" // Hindi
      placeholder="बोलने के लिए टैप करें..."
    />
  );
}
```

### 2. Language Selector

```tsx
import LanguageSelector from '../components/common/LanguageSelector';

function SettingsScreen() {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [speechCode, setSpeechCode] = useState('en-US');

  const handleLanguageChange = (langCode: string, speechCode: string) => {
    setCurrentLanguage(langCode);
    setSpeechCode(speechCode);
  };

  return (
    <LanguageSelector
      selectedLanguage={currentLanguage}
      onLanguageChange={handleLanguageChange}
      showNativeName={true}
    />
  );
}
```

### 3. Language Context Usage

```tsx
import { useTranslation } from '../contexts/LanguageContext';

function ProductCard() {
  const { t, translateText } = useTranslation();

  return (
    <View>
      <Text>{t('product.price')}</Text>
      <Text>{t('action.add_to_cart')}</Text>
    </View>
  );
}
```

## 🎤 Voice Commands Supported

### Search Commands
- "Search for rice" → Searches for rice products
- "Find mobile phones" → Searches in electronics category
- "Show me Dove products" → Brand-specific search

### Order Commands
- "Order 2 kg rice" → Adds rice to cart with quantity
- "I want to buy shampoo" → Searches and prepares for purchase
- "Add milk to cart" → Direct cart addition

### Navigation Commands
- "Go to cart" → Navigates to cart screen
- "Open my profile" → Navigates to profile
- "Show my orders" → Navigates to orders page

## 🌍 Supported Languages

| Language | Code | Speech Code | Native Name |
|----------|------|-------------|-------------|
| English | en | en-US | English |
| Hindi | hi | hi-IN | हिन्दी |
| Tamil | ta | ta-IN | தமிழ் |
| Telugu | te | te-IN | తెలుగు |
| Kannada | kn | kn-IN | ಕನ್ನಡ |
| Malayalam | ml | ml-IN | മലയാളം |
| Gujarati | gu | gu-IN | ગુજરાતી |
| Marathi | mr | mr-IN | मराठी |
| Bengali | bn | bn-IN | বাংলা |
| Punjabi | pa | pa-IN | ਪੰਜਾਬੀ |
| Odia | or | or-IN | ଓଡ଼ିଆ |
| Assamese | as | as-IN | অসমীয়া |
| Urdu | ur | ur-IN | اردو |

## 🔍 Troubleshooting

### Common Issues

1. **Microphone Permission Denied**
   - Ensure microphone permissions are granted in device settings
   - Check app permissions in device settings

2. **Speech Recognition Not Working**
   - Verify Azure Speech Services key and region
   - Check internet connectivity
   - Ensure microphone is working

3. **Translation Errors**
   - Verify Azure Translator credentials
   - Check if the target language is supported
   - Ensure internet connectivity

4. **Voice Commands Not Recognized**
   - Speak clearly and at normal pace
   - Ensure background noise is minimal
   - Try using simpler command phrases

### Debug Mode

Enable debug logging by setting:
```env
DEBUG_AZURE_AI=true
```

## 📊 Performance Optimization

### Caching Strategy
- **Translations**: Cached for 7 days
- **Voice Recognition**: Real-time, no caching
- **Language Preferences**: Stored locally

### Cost Optimization
- Use batch translation for app content
- Cache frequently used translations
- Implement request throttling
- Use appropriate service tiers

## 🔐 Security Best Practices

1. **API Keys**: Never commit API keys to version control
2. **Environment Variables**: Use secure environment variable management
3. **Permissions**: Request minimal required permissions
4. **Data Privacy**: Inform users about voice data processing

## 📈 Analytics and Monitoring

### Key Metrics to Track
- Voice search usage frequency
- Language preference distribution
- Speech recognition accuracy
- Translation cache hit rates
- User engagement with voice features

### Azure Monitoring
- Set up Azure Monitor for service health
- Configure alerts for API quota limits
- Monitor response times and error rates

## 🚀 Future Enhancements

1. **Offline Speech Recognition**: Implement on-device speech processing
2. **Custom Voice Models**: Train custom models for domain-specific terms
3. **Sentiment Analysis**: Analyze voice tone for customer satisfaction
4. **Voice Biometrics**: User authentication through voice
5. **Real-time Translation**: Live conversation translation for customer support

## 📞 Support

For technical support or questions:
- Check Azure documentation for service-specific issues
- Review React Native Speech SDK documentation
- Contact Azure support for service-related problems

## 📄 License

This implementation follows the licensing terms of:
- Microsoft Cognitive Services SDK
- Azure OpenAI Service
- React Native and Expo frameworks

---

**Note**: Ensure you comply with Azure service usage terms and data privacy regulations in your region when implementing these features.