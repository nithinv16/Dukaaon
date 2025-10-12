# Azure OpenAI Environment Variables Setup Guide

## Current Configuration Status

Your project already has Azure OpenAI configured! Here's what's currently set up:

### ✅ Already Configured in .env file:
- `EXPO_PUBLIC_AZURE_OPENAI_API_KEY`: Set
- `EXPO_PUBLIC_AZURE_AI_ENDPOINT`: Set
- `EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME`: gpt-4o
- `EXPO_PUBLIC_AZURE_AI_FOUNDRY_ENDPOINT`: Set
- `EXPO_PUBLIC_AZURE_AI_SERVICES_ENDPOINT`: Set

## Setting System Environment Variables (Optional)

If you need to set system-level environment variables for other applications or development tools, follow these steps:

### Method 1: Using PowerShell Script (Recommended)

1. **Edit the setup script**: Open `setup-azure-env.ps1` and replace the placeholder values:
   ```powershell
   $AZURE_OPENAI_ENDPOINT = "https://your-resource-name.openai.azure.com/"
   $AZURE_OPENAI_API_KEY = "your-actual-api-key-here"
   $AZURE_OPENAI_DEPLOYMENT_NAME = "your-deployment-name"
   ```

2. **Run the script**: Right-click PowerShell and "Run as Administrator", then:
   ```powershell
   cd "C:\Users\NITHIN V\App dev\dukaaon"
   .\setup-azure-env.ps1
   ```

### Method 2: Manual PowerShell Commands

Run these commands in PowerShell (replace with your actual values):

```powershell
# Set your actual values here
[System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_API_KEY', 'YOUR_ACTUAL_API_KEY', 'User')
[System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_ENDPOINT', 'YOUR_ACTUAL_ENDPOINT', 'User')
[System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_DEPLOYMENT_NAME', 'YOUR_DEPLOYMENT_NAME', 'User')
```

### Method 3: Using Windows System Properties

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables"
3. Under "User variables", click "New"
4. Add each variable:
   - Variable name: `AZURE_OPENAI_API_KEY`
   - Variable value: Your API key
   - Repeat for `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT_NAME`

## Finding Your Azure OpenAI Values

### 1. ENDPOINT
- Go to [Azure Portal](https://portal.azure.com)
- Navigate to your Azure OpenAI resource
- Go to "Keys and Endpoint" section
- Copy the "Endpoint" value
- Example: `https://docs-test-001.openai.azure.com/`

### 2. API-KEY
- In the same "Keys and Endpoint" section
- Copy either "KEY 1" or "KEY 2"
- Keep this secure and never share it publicly

### 3. DEPLOYMENT-NAME
- In your Azure OpenAI resource, go to "Resource Management" > "Deployments"
- Or visit [Azure AI Foundry](https://ai.azure.com) > Deployments
- Copy the name of your model deployment
- Example: `gpt-4`, `gpt-35-turbo`, etc.

## Verification

### Check Environment Variables
```powershell
# Check if variables are set
$env:AZURE_OPENAI_API_KEY
$env:AZURE_OPENAI_ENDPOINT
$env:AZURE_OPENAI_DEPLOYMENT_NAME
```

### Test Your Configuration
Your app should work with the current .env configuration. The environment variables are mainly needed for:
- Other development tools
- CI/CD pipelines
- Server-side applications

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use different keys for development and production**
3. **Regularly rotate your API keys**
4. **Monitor usage in Azure portal**
5. **Set up billing alerts**

## Troubleshooting

### Common Issues:

1. **Variables not recognized after setting**
   - Restart your terminal/IDE
   - Restart your computer if needed

2. **Permission denied when running PowerShell script**
   - Run PowerShell as Administrator
   - Check execution policy: `Get-ExecutionPolicy`
   - If needed: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

3. **API calls failing**
   - Verify your endpoint URL format
   - Check if your deployment name is correct
   - Ensure your API key is valid
   - Check Azure resource quotas and billing

## Current Project Status

Your Dukaaon app is already configured to use Azure OpenAI through the .env file. The chat functionality should work with:
- Azure AI Agent integration
- Speech-to-text capabilities
- Text generation
- Multi-language support

No additional setup is required for your current project unless you need system-level environment variables for other tools.

## Next Steps

1. Test the chat functionality in your app
2. Monitor usage in Azure portal
3. Consider setting up monitoring and alerts
4. Review and optimize your AI prompts

For any issues, check the Azure portal for service health and usage metrics.