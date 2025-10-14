# YearnV3 Frontend Development Guide

## Overview

This guide covers the implementation of YearnV3 vault functionality in the CryptoStock frontend, focusing on proper withdrawal flow that matches the test case requirements.

## Test Case Analysis

### Key Test Case Requirements (10-yearnv3-sepolia.test.js)

The test case defines the exact flow for YearnV3 operations:

#### Deposit Flow (Lines 91-147)
1. **Authorization**: User approves USDT tokens for YearnV3Adapter
2. **Operation**: Execute `defiAggregator.executeOperation("yearnv3", 0, params)`
3. **Parameters**: `tokens`, `amounts` (USDT amounts), `recipient`, `deadline`

#### Withdrawal Flow (Lines 172-196) ⚠️ **CRITICAL**
1. **Input Parameter**: Withdrawal amount is specified in **shares**, not USDT
2. **Authorization**: User approves **shares** to YearnV3Adapter:
   ```javascript
   await vault.connect(user).approve(yearnAdapter, sharesBefore);
   ```
3. **Operation**: Execute withdrawal with shares amount:
   ```javascript
   const sharesToWithdraw = sharesBefore / 2n; // 50% of shares
   const withdrawParams = {
     tokens: [USDT_ADDRESS],
     amounts: [reasonableWithdrawAmount], // Expected USDT output
     recipient: user.address,
     deadline: Math.floor(Date.now() / 1000) + 3600,
     tokenId: 0,
     extraData: "0x"
   };
   await defiAggregator.executeOperation("yearnv3", 1, withdrawParams);
   ```

## Current Implementation Issues

### ❌ Issue #1: Input Parameter Mismatch
**Problem**: Frontend asks users to input USDT amount for withdrawal
**Expected**: Users should input shares amount (like the test case)

**Current Code (YearnV3WithdrawModal.tsx:408):**
```tsx
<label className="block text-sm font-medium text-gray-300 mb-2">
  提取数量 (USDT)  <!-- ❌ Should be SHARES -->
</label>
```

### ❌ Issue #2: Preview Function Parameter Type
**Problem**: `previewWithdraw` expects shares but receives USDT amounts

**Hook Implementation (useYearnV3WithClients.ts:185):**
```tsx
const previewWithdraw = useCallback(async (shares: string) => {
  // Expects SHARES amount
  const sharesBigInt = parseUnits(shares, TOKEN_DECIMALS.SHARES);
  // ...
}, [publicClient, store]);
```

**Modal Usage (YearnV3WithdrawModal.tsx:117):**
```tsx
// ❌ Passing USDT amount instead of shares
const preview = await previewWithdraw(value);
```

### ❌ Issue #3: Withdrawal Function Parameter
**Problem**: `withdraw` function expects USDT amount but should expect shares

**Hook Implementation (useYearnV3WithClients.ts:226):**
```tsx
const withdraw = useCallback(async (amount: string) => {
  const amountBigInt = parseUnits(amount, TOKEN_DECIMALS.USDT); // ❌ Should be SHARES
  // ...
}, [isConnected, publicClient, chain, getWalletClient, store, address]);
```

## Required Fixes

### Fix #1: Update User Interface Input

**File**: `components/YearnV3WithdrawModal.tsx`

Change input label and validation:
```tsx
// ❌ Current
<label className="block text-sm font-medium text-gray-300 mb-2">
  提取数量 (USDT)
</label>

// ✅ Should be
<label className="block text-sm font-medium text-gray-300 mb-2">
  提取数量 (Shares)
</label>
```

Update placeholder and validation:
```tsx
<input
  type="text"
  value={amount}
  onChange={handleAmountChange}
  placeholder="0.00"  // Should show shares
  // ...
/>
```

### Fix #2: Update Preview Logic

**File**: `components/YearnV3WithdrawModal.tsx`

```tsx
// ✅ Correct: Use shares directly for preview
const handleAmountChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;

  if (/^\d*\.?\d{0,6}$/.test(value) || value === '') {
    setAmount(value); // This is now SHARES amount
    setPercentage(0);

    if (validateAmount(value)) {
      const timeoutId = setTimeout(async () => {
        try {
          // ✅ Preview with shares amount
          const preview = await previewWithdraw(value);
          if (preview.success && preview.data) {
            setPreviewData({
              assets: preview.data.assets.toString(),
              formattedAssets: preview.data.formattedAssets,
              requiredShares: value,
              inputSharesAmount: value
            });
          }
        } catch (error) {
          console.error('预览失败:', error);
          setPreviewData(null);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setPreviewData(null);
    }
  }
};
```

### Fix #3: Update Withdraw Function

**File**: `lib/hooks/useYearnV3WithClients.ts`

```tsx
// ✅ Updated withdrawal function
const withdraw = useCallback(async (sharesAmount: string) => {
  if (!isConnected || !address) {
    throw new Error('请先连接钱包');
  }

  // ... validation code ...

  try {
    store.setOperating(true);
    store.setError(null);

    console.log('🚀 开始取款操作...', { sharesAmount });

    // ✅ Parse as SHARES, not USDT
    const sharesBigInt = parseUnits(sharesAmount, TOKEN_DECIMALS.SHARES);

    // Preview to get expected USDT amount
    const previewResult = await previewWithdraw(sharesAmount);
    if (!previewResult.success) {
      throw new Error('无法预览取款金额');
    }

    const expectedUsdtAmount = previewResult.data.assets;

    // ✅ Use expected USDT amount for operation params
    const operationParams = {
      tokens: [DEPLOYMENT_ADDRESSES.usdtToken],
      amounts: [expectedUsdtAmount.toString()], // Expected USDT output
      recipient: address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      tokenId: "0",
      extraData: "0x" as const,
    };

    // Execute withdrawal through DefiAggregator
    const hash = await wc.writeContract({
      address: defiAggregatorAddress,
      abi: typedDefiAggregatorABI,
      functionName: 'executeOperation',
      args: [
        "yearnv3",                              // Adapter name
        YearnV3OperationType.WITHDRAW,          // Withdraw operation
        operationParams                         // Operation parameters
      ],
      chain,
      account: address,
    });

    // ... rest of the function ...
  } catch (error) {
    // ... error handling ...
  }
}, [isConnected, publicClient, chain, getWalletClient, store, address, previewWithdraw]);
```

### Fix #4: Update Validation and Display

**File**: `components/YearnV3WithdrawModal.tsx`

```tsx
// ✅ Updated validation function
const validateAmount = (value: string): boolean => {
  if (!value || parseFloat(value) <= 0) return false;
  const maxShares = parseFloat(maxBalances.maxSharesToWithdraw);
  return parseFloat(value) <= maxShares;
};

// ✅ Updated max amount handler
const handleMaxAmount = () => {
  setAmount(maxBalances.maxSharesToWithdraw); // Max shares, not USDT
  setPercentage(100);
};

// ✅ Updated percentage handler
const handlePercentageSelect = (percent: number) => {
  setPercentage(percent);
  const maxShares = parseFloat(maxBalances.maxSharesToWithdraw);
  const selectedShares = (maxShares * percent / 100).toFixed(6);
  setAmount(selectedShares);
};
```

### Fix #5: Update State Types

**File**: `components/YearnV3WithdrawModal.tsx`

```tsx
// ✅ Updated preview data state type
const [previewData, setPreviewData] = useState<{
  assets: string;
  formattedAssets: string;
  requiredShares: string;
  inputSharesAmount: string;
} | null>(null);
```

## Updated Flow Summary

### Correct Withdrawal Flow

1. **User Input**: User enters shares amount (e.g., "0.05" shares)
2. **Validation**: Validate against user's available shares balance
3. **Preview**: Call `previewWithdraw(sharesAmount)` to get expected USDT
4. **Authorization**: Approve shares amount to YearnV3Adapter
5. **Execution**: Call withdrawal with shares amount
6. **Display**: Show expected USDT output to user

### UI Updates Needed

```tsx
// Input section should show:
- Input field: Shares amount (e.g., 0.05)
- Balance display: Available: 0.099799 shares
- Preview: Expected to receive: ~45 USDT
- Percentage buttons: 25%, 50%, 75%, 100% of shares
```

## Testing Strategy

### Manual Testing Steps

1. **Deposit**: Deposit 100 USDT to get shares
2. **Check Balance**: Verify shares amount displayed correctly
3. **Withdrawal Test**:
   - Enter shares amount (e.g., 0.05)
   - Verify preview shows expected USDT amount
   - Approve shares authorization
   - Execute withdrawal
   - Verify final balances

### Expected Behavior

- User inputs: "0.05" shares
- System shows: "Expected to receive: ~45 USDT"
- Authorization: Approve 0.05 shares to YearnV3Adapter
- Result: User receives ~45 USDT, shares balance reduced by 0.05

## Implementation Priority

1. **HIGH**: Fix input parameter type (shares vs USDT)
2. **HIGH**: Update preview function usage
3. **HIGH**: Update withdrawal function parameters
4. **MEDIUM**: Update UI labels and displays
5. **LOW**: Add additional validation and error handling

## Related Files

- `components/YearnV3WithdrawModal.tsx` - Main withdrawal modal
- `lib/hooks/useYearnV3WithClients.ts` - YearnV3 operations hook
- `lib/stores/useYearnV3Store.ts` - State management
- `test/10-yearnv3-sepolia.test.js` - Reference test case

## Common Pitfalls

1. **Mixing USDT and shares amounts** - Always be clear which unit you're working with
2. **Precision errors** - Shares use 18 decimals, USDT uses 6 decimals
3. **Authorization targets** - USDT approval goes to adapter, shares approval goes to vault
4. **Preview vs execution** - Preview expects shares, execution expects USDT amounts in params

## Debugging Tips

```tsx
// Add debug logging to track amounts
console.log('Withdrawal Debug:', {
  inputAmount: amount,
  inputUnit: 'SHARES',
  previewResult: previewData,
  expectedUSDT: previewData?.formattedAssets,
  authorizationAmount: amount, // Shares amount
});
```

This guide should help implement the withdrawal functionality correctly according to the test case requirements.