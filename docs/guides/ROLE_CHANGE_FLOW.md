# 🔄 Role Change Flow - Visual Guide

## 📱 Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                   USER OPENS APP                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  LOGIN SCREEN                               │
│  Phone: [__________]                                        │
│  Role:  ( ) Retailer  (●) Seller  ← User selects role     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 SEND OTP                                    │
│  Role stored in AsyncStorage                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 VERIFY OTP                                  │
│  User enters 6-digit code                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              CHECK IF PROFILE EXISTS                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
            ┌───────────────┴───────────────┐
            ↓                               ↓
   ┌────────────────┐              ┌────────────────┐
   │  NEW USER      │              │  EXISTING USER │
   │  No Profile    │              │  Has Profile   │
   └────────────────┘              └────────────────┘
            ↓                               ↓
   ┌────────────────┐              ┌────────────────┐
   │ CREATE PROFILE │              │  🆕 NEW LOGIC  │
   │ With Selected  │              │  CHECK ROLE    │
   │ Role           │              │  CHANGE        │
   └────────────────┘              └────────────────┘
            ↓                               ↓
   ┌────────────────┐              ┌────────────────┐
   │ Go to KYC Form │              │ Role Changed?  │
   └────────────────┘              └────────────────┘
                                            ↓
                              ┌─────────────┴─────────────┐
                              ↓                           ↓
                         ┌─────────┐               ┌─────────┐
                         │   YES   │               │   NO    │
                         └─────────┘               └─────────┘
                              ↓                           ↓
                    ┌─────────────────────┐    ┌──────────────┐
                    │  CHECK KYC STATUS   │    │ Proceed with │
                    └─────────────────────┘    │ existing role│
                              ↓                └──────────────┘
                ┌─────────────┴─────────────┐
                ↓                           ↓
         ┌─────────────┐            ┌─────────────┐
         │KYC COMPLETE │            │KYC INCOMPLETE│
         └─────────────┘            └─────────────┘
                ↓                           ↓
         ┌─────────────┐            ┌─────────────┐
         │  🔒 REJECT  │            │  ✅ ALLOW   │
         │Role Change  │            │Role Change  │
         └─────────────┘            └─────────────┘
                ↓                           ↓
         ┌─────────────┐            ┌─────────────┐
         │Keep OLD Role│            │Update to NEW│
         │in Database  │            │Role in DB   │
         └─────────────┘            └─────────────┘
                ↓                           ↓
         ┌─────────────┐            ┌─────────────┐
         │ Redirect to │            │ Redirect to │
         │OLD Dashboard│            │NEW KYC Form │
         └─────────────┘            └─────────────┘
```

---

## 🎯 Decision Tree

```
                    ┌──────────────────┐
                    │  User Logs In    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Profile Exists? │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────────────┐
                    │  No → Create Profile    │
                    │  Yes → Check Changes    │
                    └────────┬────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Role Changed?   │
                    └────────┬─────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
         ┌───────▼────────┐     ┌───────▼────────┐
         │      YES       │     │       NO       │
         └───────┬────────┘     └───────┬────────┘
                 │                       │
         ┌───────▼────────┐              │
         │  Check KYC     │              │
         │  Completion    │              │
         └───────┬────────┘              │
                 │                       │
     ┌───────────┴──────────┐           │
     │                      │           │
┌────▼────┐          ┌─────▼─────┐     │
│Complete │          │Incomplete │     │
└────┬────┘          └─────┬─────┘     │
     │                     │           │
┌────▼────┐          ┌─────▼─────┐     │
│ REJECT  │          │  ALLOW    │     │
│ Change  │          │  Change   │     │
└────┬────┘          └─────┬─────┘     │
     │                     │           │
     └──────────┬──────────┴───────────┘
                │
         ┌──────▼──────┐
         │   Route to  │
         │   Correct   │
         │   Screen    │
         └─────────────┘
```

---

## 📊 KYC Completion Check

### For Sellers/Wholesalers:

```sql
SELECT * FROM seller_details 
WHERE user_id = '[user_id]';

-- Check if ALL fields present:
✅ business_name IS NOT NULL
✅ owner_name IS NOT NULL
✅ gst_number IS NOT NULL

↓

IF all present → KYC COMPLETE ✅
IF any missing → KYC INCOMPLETE ❌
```

### For Retailers:

```javascript
profile.business_details = {
  shopName: "...",
  ownerName: "...",
  address: "..."
}

// Check conditions:
✅ business_details exists
✅ shopName NOT "My Shop" (default)
✅ ownerName filled
✅ address NOT "Address pending" (default)

↓

IF all true → KYC COMPLETE ✅
IF any false → KYC INCOMPLETE ❌
```

---

## 🎭 Real-World Scenarios

### Scenario A: Retailer → Seller (No KYC)

```
Day 1:
  User signs up as RETAILER
  Verifies OTP
  Role saved: "retailer" ✅
  Closes app ❌ (No KYC)

Day 2:
  Opens app
  Selects SELLER role
  Verifies OTP
  
  System checks:
  ✓ Role changed (retailer → seller)
  ✓ Check seller_details: NOT FOUND
  ✓ KYC Status: INCOMPLETE
  
  System does:
  ✅ Update role to "seller" in DB
  ✅ Redirect to Seller KYC
  
  Result: ✅ FIXED!
```

---

### Scenario B: Seller → Retailer (KYC Done)

```
Day 1:
  User signs up as SELLER
  Completes Seller KYC ✅
  seller_details created ✅
  
Day 2:
  Opens app
  Selects RETAILER role (by mistake)
  Verifies OTP
  
  System checks:
  ✓ Role changed (seller → retailer)
  ✓ Check seller_details: FOUND
  ✓ Has business_name, owner_name, gst_number
  ✓ KYC Status: COMPLETE
  
  System does:
  ❌ REJECT role change
  ✅ Keep as "seller"
  ✅ Redirect to Seller Dashboard
  
  Result: ✅ PROTECTED!
```

---

### Scenario C: No Role Change

```
Day 1:
  User signs up as RETAILER
  
Day 2:
  Opens app
  Selects RETAILER again (same role)
  Verifies OTP
  
  System checks:
  ✓ Role unchanged (retailer = retailer)
  
  System does:
  ✅ Skip all checks
  ✅ Proceed normally
  
  Result: ✅ FAST!
```

---

## 🔍 Code Location

```typescript
File: app/(auth)/otp.tsx
Lines: 265-349

Key Logic:
├── Line 270: Get existing role
├── Line 271: Get selected role
├── Line 273: Check if changed
├── Line 279-293: Check Seller KYC
├── Line 294-306: Check Retailer KYC
├── Line 309-333: Allow change
└── Line 334-347: Reject change
```

---

## 🎉 Summary

### ✅ What Works:

1. **New users** → Create profile with selected role
2. **Existing users (no KYC)** → Can change role freely
3. **Existing users (KYC done)** → Role locked, change rejected
4. **Same role** → Fast-path, no extra checks

### 🔒 What's Protected:

1. **KYC Data Integrity** → No orphaned records
2. **Business Verification** → Tied to specific role
3. **Fraud Prevention** → Can't abuse role switching
4. **User Experience** → Clear feedback, no confusion

---

**Visual guide complete! Users can now understand exactly how role changes work.** 🎨

*Created: January 13, 2025*

