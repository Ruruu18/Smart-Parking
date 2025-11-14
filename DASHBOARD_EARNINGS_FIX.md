# Dashboard Earnings Exclusion Fix

## Problem
After checking out a vehicle and deleting the parking space, the dashboard still included those payments in the earnings calculations (Daily Revenue and Total Earnings), even though the parking space no longer existed.

## Solution
Modified the earnings queries to exclude payments for sessions where the parking space has been deleted (`space_id IS NULL`).

## Changes Made

### File: `Parking/src/screens/home/AdminDashboard.jsx`

#### 1. Daily Revenue Calculation (`fetchTodayRevenue`) - Lines 277-329

**Before:**
```javascript
const fetchPromise = supabase
  .from("payments")
  .select("amount, status, created_at")
  .gte("created_at", start.toISOString())
  .lte("created_at", end.toISOString())
  .in("status", ["completed", "pending"]);
```

**After:**
```javascript
// Join with parking_sessions to filter out payments for deleted spaces
// Only count payments where the session still has a space_id (not deleted)
const fetchPromise = supabase
  .from("payments")
  .select("amount, status, created_at, session_id, parking_sessions!inner(space_id)")
  .gte("created_at", start.toISOString())
  .lte("created_at", end.toISOString())
  .in("status", ["completed", "pending"])
  .not("parking_sessions.space_id", "is", null);
```

#### 2. Total Earnings Calculation (`fetchTotalEarnings`) - Lines 331-359

**Before:**
```javascript
const fetchPromise = supabase
  .from("payments")
  .select("amount")
  .eq("status", "completed");
```

**After:**
```javascript
// Join with parking_sessions to filter out payments for deleted spaces
// Only count payments where the session still has a space_id (not deleted)
const fetchPromise = supabase
  .from("payments")
  .select("amount, session_id, parking_sessions!inner(space_id)")
  .eq("status", "completed")
  .not("parking_sessions.space_id", "is", null);
```

## How It Works

### Database Relationship:
```
payments → session_id → parking_sessions → space_id → parking_spaces
```

### Query Logic:
1. **Inner Join**: Uses `parking_sessions!inner(space_id)` to join payments with their sessions
2. **Filter**: `.not("parking_sessions.space_id", "is", null)` excludes sessions with null space_id
3. **Result**: Only counts payments for sessions with active parking spaces

### Checkout Flow:
1. Vehicle checks out
2. Parking space is deleted
3. Session's `space_id` is set to NULL (preserves history)
4. Payment remains in database (audit trail)
5. Dashboard queries exclude this payment from earnings (correct accounting)

## What Gets Excluded

Payments are excluded from earnings calculations when:
- ✅ The parking space has been deleted after checkout
- ✅ The session's `space_id` is NULL
- ✅ Payment status is "completed" or "pending"

## What Remains Included

Payments are still counted in earnings when:
- ✅ The parking space still exists
- ✅ The session has an active `space_id`
- ✅ Payment status is "completed" or "pending"

## Important Notes

### Recent Payments List
The "Recent Payments" activity list (around line 412) was **NOT modified** because:
- It shows historical activity for audit purposes
- Users need to see all payment transactions
- It doesn't affect the earnings calculations
- Provides complete financial audit trail

### Payment Preservation
Payments are never deleted - they remain in the database for:
- Financial records and accounting
- Audit trails and compliance
- Historical analysis
- Dispute resolution

## Testing

To verify the fix:

1. **Before Checkout:**
   - Note the Daily Revenue amount
   - Note the Total Earnings amount

2. **Create Test Booking:**
   ```
   1. Book a parking space
   2. Check in the vehicle
   3. Make a payment (e.g., ₱100)
   4. Verify earnings increase by ₱100
   ```

3. **Check Out (Delete Space):**
   ```
   1. Check out the vehicle
   2. Space is deleted
   3. Payment is preserved in database
   4. Verify earnings decrease by ₱100
   ```

4. **Verify in Database:**
   ```sql
   -- Check session has NULL space_id
   SELECT id, space_id, status FROM parking_sessions
   WHERE id = 'your_session_id';

   -- Check payment still exists
   SELECT * FROM payments
   WHERE session_id = 'your_session_id';

   -- Check earnings query excludes it
   SELECT p.amount, ps.space_id
   FROM payments p
   INNER JOIN parking_sessions ps ON p.session_id = ps.id
   WHERE p.status = 'completed'
   AND ps.space_id IS NOT NULL;
   ```

## Benefits

✅ **Accurate Accounting**: Earnings reflect only active parking spaces
✅ **Audit Trail**: All payment records preserved for history
✅ **Consistent Data**: Dashboard stats match actual active operations
✅ **Clean Reporting**: Financial reports show correct revenue
✅ **Compliance**: Complete transaction history maintained

## Related Files

- `AdminDashboard.jsx` - Dashboard earnings calculations
- `OccupiedSpaceDetails.jsx` - Checkout and space deletion logic
- `database.sql` - Foreign key constraints (ON DELETE SET NULL)
- `PAYMENT_PRESERVATION_FIX.md` - Related payment preservation documentation

## Rollback (if needed)

To revert to the old behavior (not recommended):

```javascript
// In fetchTodayRevenue
const fetchPromise = supabase
  .from("payments")
  .select("amount, status, created_at")
  .gte("created_at", start.toISOString())
  .lte("created_at", end.toISOString())
  .in("status", ["completed", "pending"]);

// In fetchTotalEarnings
const fetchPromise = supabase
  .from("payments")
  .select("amount")
  .eq("status", "completed");
```

**WARNING**: This will cause the dashboard to show incorrect earnings including payments for deleted spaces!
