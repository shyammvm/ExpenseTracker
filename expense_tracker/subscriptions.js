// ---------- CONFIG SECTION ----------
const NOTION_TOKEN_THIS = getSecrets("notion_token");
const SUBSCRIPTIONS_DB_ID = getSecrets("debit_instructions");
const EXPENSES_DB_ID = getSecrets("debit");
const INSTRUCTIONS_DB_ID = getSecrets("credit_instructions");
const CREDIT_CARD_DB_ID = getSecrets("credit");
// ------------------------------------

function addDueItemsToNotion() {
  const today = new Date().getDate();

  const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN_THIS}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  // Step 1: Add due subscriptions to expenses
  const subPayload = {
    "filter": {
      "and": [
        { "property": "Active", "checkbox": { "equals": true } },
        { "property": "Debit Day", "number": { "equals": today } }
      ]
    },
    "page_size": 100
  };

  const subResponse = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${SUBSCRIPTIONS_DB_ID}/query`, {
    method: "post",
    headers: headers,
    payload: JSON.stringify(subPayload)
  });

  const subscriptions = JSON.parse(subResponse.getContentText()).results;

  subscriptions.forEach(sub => {
    const props = sub.properties;
    const expensePayload = {
      parent: { database_id: EXPENSES_DB_ID },
      properties: {
        "Name": { "title": [{ "text": { "content": props.Name?.title?.[0]?.plain_text || "Subscription" } }] },
        "Amount": { "number": props.Amount?.number || 0 },
        "Category": { "select": { "name": props.Category?.select?.name || "Subscription" } },
        "Date": { "date": { "start": new Date().toISOString().split("T")[0] } },
        "Notes": { "rich_text": [{ "text": { "content": "Auto-added from Subscriptions" } }] }
      }
    };

    UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
      method: "post",
      headers: headers,
      payload: JSON.stringify(expensePayload)
    });
  });

  // Step 2: Add due credit card instructions
  const ccQueryResponse = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${INSTRUCTIONS_DB_ID}/query`, {
    method: "post",
    headers: headers,
    payload: JSON.stringify({ page_size: 100 })
  });

  const instructions = JSON.parse(ccQueryResponse.getContentText()).results;

  instructions.forEach(page => {
    const props = page.properties;
    const active = props.Active?.checkbox || false;
    const debitDay = parseInt(props["Debit Day"]?.number || 0);

    if (active && debitDay === today) {
      const creditPayload = {
        parent: { database_id: CREDIT_CARD_DB_ID },
        properties: {
          Name: { title: [{ text: { content: props.Name?.title?.[0]?.plain_text || "" } }] },
          Amount: { number: props.Amount?.number || 0 },
          Category: { select: { name: props.Category?.select?.name || "" } },
          Date: { date: { start: new Date().toISOString().split("T")[0] } },
          Notes: { rich_text: [{ text: { content: "Auto-added from instructions" } }] }
        }
      };

      UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
        method: "post",
        headers: headers,
        payload: JSON.stringify(creditPayload)
      });
    }
  });
}