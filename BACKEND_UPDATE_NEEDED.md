# Backend Update Required for "Show Other Availability" Feature

## Feature Description
Nhân viên khi vào tick lịch sẽ thấy ca mà những nhân viên khác đã tick trước đó (hiển thị mờ).

## Backend Changes Needed

### New API Action: `getAllAvailability`

Add this new action to your Google Apps Script `doPost` function:

```javascript
if (action === 'getAllAvailability') {
  return getAllAvailability(data);
}
```

### Implementation

```javascript
/**
 * Get all team members' availability for a specific week
 * Returns availability for ALL users in the team (not just current user)
 * 
 * @param {Object} data - { weekStart: "2025-12-08", team: "cs" }
 * @returns {Object} - { success: true, availability: [...] }
 */
function getAllAvailability(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Availability');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Availability sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const weekStart = data.weekStart; // "2025-12-08"
    const team = (data.team || 'cs').toLowerCase();
    
    // Calculate week end (Sunday)
    const startDate = new Date(weekStart + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const weekEnd = Utilities.formatDate(endDate, 'GMT+7', 'yyyy-MM-dd');
    
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    
    // Find column indices
    const emailCol = headers.indexOf('email');
    const nameCol = headers.indexOf('name');
    const teamCol = headers.indexOf('team');
    const dateCol = headers.indexOf('date');
    const shiftCol = headers.indexOf('shift');
    
    if (emailCol < 0 || dateCol < 0 || shiftCol < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Required columns not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const availability = [];
    
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const rowDate = String(row[dateCol] || '').substring(0, 10);
      const rowTeam = String(row[teamCol] || '').toLowerCase();
      
      // Filter by team and week
      if (rowTeam !== team) continue;
      if (rowDate < weekStart || rowDate > weekEnd) continue;
      
      availability.push({
        email: row[emailCol] || '',
        name: row[nameCol] || row[emailCol] || '',
        team: row[teamCol] || '',
        date: rowDate,
        shift: row[shiftCol] || ''
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      availability: availability
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('getAllAvailability error: ' + error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Expected Response Format

```json
{
  "success": true,
  "availability": [
    {
      "email": "employee1@crushroom.vn",
      "name": "Nguyễn Văn An",
      "team": "cs",
      "date": "2025-12-08",
      "shift": "08-09"
    },
    {
      "email": "employee2@crushroom.vn",
      "name": "Trần Thị Bình",
      "team": "cs",
      "date": "2025-12-08",
      "shift": "08-09"
    }
    // ... more entries
  ]
}
```

## Testing

1. Deploy the updated Google Apps Script
2. Test the endpoint with:
   ```javascript
   {
     "action": "getAllAvailability",
     "weekStart": "2025-12-08",
     "team": "cs"
   }
   ```
3. Verify the response contains all team members' availability
4. Test in the frontend - employees should see dimmed names below checkboxes

## Notes

- This endpoint returns availability for ALL users in the team (not filtered by current user)
- The frontend filters out the current user's data and only shows "others"
- Names are extracted and shown in short form (first name only)
- The display is muted/dimmed to differentiate from the user's own selection
