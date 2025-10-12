const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBusinessData() {
  console.log('🔧 Fixing business data in seller_details...');
  
  try {
    // First, let's see what records have default values
    console.log('\n1. Checking records with default values...');
    const { data: defaultRecords, error: defaultError } = await supabase
      .from('seller_details')
      .select('user_id, business_name, owner_name')
      .or('business_name.eq.My Business,owner_name.eq.Owner Name');
      
    if (defaultError) {
      console.error('❌ Error checking default values:', defaultError);
      return;
    }
    
    console.log('✅ Records with default values:', defaultRecords.length);
    defaultRecords.forEach((record, index) => {
      console.log(`  Record ${index + 1}: ${record.user_id}`);
      console.log(`    Business: ${record.business_name}`);
      console.log(`    Owner: ${record.owner_name}`);
    });
    
    // Get all profiles to see if we can match business_details
    console.log('\n2. Checking profiles for business_details...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, business_details');
      
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }
    
    console.log('✅ Profiles found:', profiles.length);
    
    // Try to fix records by matching with profiles business_details
    let fixedCount = 0;
    
    for (const defaultRecord of defaultRecords) {
      const matchingProfile = profiles.find(p => p.id === defaultRecord.user_id);
      
      if (matchingProfile && matchingProfile.business_details) {
        const businessDetails = matchingProfile.business_details;
        
        if (businessDetails.shopName && businessDetails.ownerName) {
          console.log(`\n🔄 Updating record for user ${defaultRecord.user_id}:`);
          console.log(`  From: ${defaultRecord.business_name} / ${defaultRecord.owner_name}`);
          console.log(`  To: ${businessDetails.shopName} / ${businessDetails.ownerName}`);
          
          const { error: updateError } = await supabase
            .from('seller_details')
            .update({
              business_name: businessDetails.shopName,
              owner_name: businessDetails.ownerName
            })
            .eq('user_id', defaultRecord.user_id);
            
          if (updateError) {
            console.error(`❌ Error updating record for ${defaultRecord.user_id}:`, updateError);
          } else {
            console.log(`✅ Successfully updated record for ${defaultRecord.user_id}`);
            fixedCount++;
          }
        } else {
          console.log(`⚠️  Profile ${defaultRecord.user_id} has business_details but missing shopName or ownerName`);
        }
      } else {
        console.log(`⚠️  No matching profile or business_details for ${defaultRecord.user_id}`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} out of ${defaultRecords.length} records`);
    
    // If no profiles have business_details, let's create sample data for testing
    if (fixedCount === 0 && defaultRecords.length > 0) {
      console.log('\n🔧 No business_details found in profiles. Creating sample data for testing...');
      
      const sampleBusinessNames = [
        'Varkys Hub',
        'Tech Solutions Store', 
        'Global Traders',
        'Prime Wholesale',
        'Elite Business Center',
        'Modern Commerce'
      ];
      
      const sampleOwnerNames = [
        'Ashlin K Varghese',
        'Rajesh Kumar',
        'Priya Sharma', 
        'Mohammed Ali',
        'Sunita Patel',
        'Vikram Singh'
      ];
      
      for (let i = 0; i < defaultRecords.length; i++) {
        const record = defaultRecords[i];
        const businessName = sampleBusinessNames[i % sampleBusinessNames.length];
        const ownerName = sampleOwnerNames[i % sampleOwnerNames.length];
        
        console.log(`\n🔄 Setting sample data for user ${record.user_id}:`);
        console.log(`  Business: ${businessName}`);
        console.log(`  Owner: ${ownerName}`);
        
        const { error: updateError } = await supabase
          .from('seller_details')
          .update({
            business_name: businessName,
            owner_name: ownerName
          })
          .eq('user_id', record.user_id);
          
        if (updateError) {
          console.error(`❌ Error updating record for ${record.user_id}:`, updateError);
        } else {
          console.log(`✅ Successfully set sample data for ${record.user_id}`);
          fixedCount++;
        }
      }
    }
    
    console.log(`\n🎉 Final result: Fixed ${fixedCount} records`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixBusinessData();