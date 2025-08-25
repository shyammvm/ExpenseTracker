function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('towidget');
  const data = sheet.getRange(1, 2, 4, 1).getValues();  // Column B, rows 1-3

  const today = (data[0][0] || 0).toLocaleString('en-IN');
  const week = (data[1][0] || 0).toLocaleString('en-IN');
  const month = (data[2][0] || 0).toLocaleString('en-IN');
  const cc = (data[3][0] || 0).toLocaleString('en-IN');

  const summary = `Today: ${today}\nWeek: ${week}\nMonth: ${month} \nCC: ${cc}`;

  const response = { summary: summary };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}