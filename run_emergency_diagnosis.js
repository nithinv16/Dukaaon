const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

console.log('🚨 EMERGENCY DIAGNOSIS: Persistent OTP Signup Error\n');

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.log('⚠️  Using manual diagnosis approach - please run these queries in Supabase SQL Editor:\n');
  
  try {
    const sqlContent = fs.readFileSync('./EMERGENCY_SIGNUP_DIAGNOSIS.sql', 'utf8');
    console.log('📋 Copy and paste this SQL into your Supabase SQL Editor:');
    console.log('=' .repeat(80));
    console.log(sqlContent);
    console.log('=' .repeat(80));
    console.log('\n🎯 This will help identify:');
    console.log('   1. Whether our triggers were created');
    console.log('   2. Whether our functions exist');
    console.log('   3. The current profiles table structure');
    console.log('   4. Foreign key constraints');
    console.log('   5. Access to auth.users table');
    console.log('   6. RLS policies');
    console.log('   7. Basic profile insertion test');
  } catch (error) {
    console.error('❌ Error reading diagnosis file:', error.message);
  }
  
  return;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runEmergencyDiagnosis() {
  try {
    console.log('🔍 Running emergency diagnosis...\n');
    
    // 1. Check triggers
    console.log('1️⃣ Checking database triggers...');
    const { data: triggers, error: triggerError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name, event_manipulation, event_object_table, action_timing')
      .in('trigger_name', ['on_auth_user_created', 'on_profile_update']);
    
    if (triggerError) {
      console.log('❌ Cannot check triggers:', triggerError.message);
    } else {
      console.log('✅ Triggers found:', triggers?.length || 0);
      triggers?.forEach(t => console.log(`   - ${t.trigger_name} on ${t.event_object_table}`));
    }
    
    // 2. Check functions
    console.log('\n2️⃣ Checking database functions...');
    const { data: functions, error: functionError } = await supabase.rpc('sql', {
      query: `SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('handle_new_auth_user', 'handle_profile_update') AND routine_schema = 'public';`
    });
    
    if (functionError) {
      console.log('❌ Cannot check functions:', functionError.message);
    } else {
      console.log('✅ Functions found:', functions?.length || 0);
    }
    
    // 3. Check profiles table structure
    console.log('\n3️⃣ Checking profiles table structure...');
    const { data: columns, error: columnError } = await supabase.rpc('sql', {
      query: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public' ORDER BY ordinal_position;`
    });
    
    if (columnError) {
      console.log('❌ Cannot check table structure:', columnError.message);
    } else {
      console.log('✅ Profiles table columns:');
      columns?.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
    }
    
    // 4. Test basic profile creation
    console.log('\n4️⃣ Testing basic profile creation...');
    const testId = crypto.randomUUID();
    const { data: testProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: testId,
        phone_number: '+1234567890',
        role: 'retailer',
        language: 'en',
        status: 'active'
      })
      .select();
    
    if (profileError) {
      console.log('❌ Profile creation failed:', profileError.message);
      console.log('🔍 This might be the root cause of the signup error!');
    } else {
      console.log('✅ Profile creation successful');
      
      // Clean up test profile
      await supabase.from('profiles').delete().eq('id', testId);
    }
    
    // 5. Check auth.users access
    console.log('\n5️⃣ Checking auth.users access...');
    const { data: authUsers, error: authError } = await supabase.rpc('sql', {
      query: 'SELECT COUNT(*) as count FROM auth.users;'
    });
    
    if (authError) {
      console.log('❌ Cannot access auth.users:', authError.message);
      console.log('🔍 This could be why the trigger isn\'t working!');
    } else {
      console.log('✅ Auth users count:', authUsers?.[0]?.count || 0);
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('📋 Please check the errors above to identify the root cause.');
    
  } catch (error) {
    console.error('❌ Emergency diagnosis failed:', error.message);
  }
}

runEmergencyDiagnosis();