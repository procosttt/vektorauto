import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../workflow/Vektor-Auto-V2.2-Portfolio-Demo.json', import.meta.url);
const outputPath = new URL('../workflow/Vektor-Auto-V2.3-Website-Demo.json', import.meta.url);
const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const copy = (name) => structuredClone(byName(name));

workflow.name = 'Vektor Auto V2.3 — Website Portfolio Demo';

workflow.nodes.push({
  parameters: {
    httpMethod: 'POST',
    path: 'vektor-auto-lead',
    authentication: 'headerAuth',
    responseMode: 'onReceived',
    options: {},
  },
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2.1,
  position: [80, 224],
  id: '872bd160-c2be-4c71-b5b8-3028d476c928',
  name: 'Website Gateway',
  webhookId: 'a7830924-68e0-473f-b82a-e80d509c4079',
});

byName('Normalize Form').parameters.jsCode = `const source = $json.body && typeof $json.body === 'object' ? $json.body : $json;
const phone = String(source.phone || '').replace(/[^\\d+]/g, '');
if (!/^\\+?\\d{10,15}$/.test(phone)) throw new Error('Некорректный телефон');
const form = {
  name: String(source.name || '').trim(), phone, car: String(source.car || '').trim(),
  problem: String(source.problem || '').trim(),
  desired_time: [String(source.desired_date || '').trim(), String(source.desired_time || '').trim()].filter(Boolean).join(' '),
};
return [{ json: {
  request_id: String(source.request_id || '').trim(), source: source.source === 'website' ? 'website' : 'form',
  client_chat_id: '', received_at: new Date().toISOString(), form_data: form,
  current_message: 'Новая заявка из формы: ' + JSON.stringify(form),
} }];`;

byName('Validate Form AI').parameters.jsCode = byName('Validate Form AI').parameters.jsCode.replace(
  'source: context.source, client_chat_id:',
  "request_id: String(context.request_id || existing.request_id || ''),\n  source: context.source, client_chat_id:",
);

const upsert = byName('Upsert Form Lead').parameters.columns;
upsert.value.request_id = '={{ $json.request_id }}';
upsert.schema.push({
  id: 'request_id', displayName: 'request_id', required: false, defaultMatch: false,
  display: true, type: 'string', readOnly: false, removed: false,
});

byName('Parse Telegram Update').parameters.jsCode = `const q = $json.callback_query;
if (q) {
  const [action, leadId] = String(q.data || '').split(':', 2);
  return [{ json: { kind: 'callback', action, lead_id: leadId, callback_query_id: q.id, actor_chat_id: String(q.message?.chat?.id || ''), callback_message_id: q.message?.message_id } }];
}
const m = $json.message || {};
const text = String(m.text || '').trim();
if (!text || !m.chat?.id) return [];
const websiteLink = text.match(/^\\/start\\s+site_([a-f0-9]{32})$/i);
if (websiteLink) {
  const id = websiteLink[1].toLowerCase();
  const request_id = [id.slice(0, 8), id.slice(8, 12), id.slice(12, 16), id.slice(16, 20), id.slice(20)].join('-');
  return [{ json: { kind: 'website_link', request_id, client_chat_id: String(m.chat.id), received_at: new Date().toISOString() } }];
}
return [{ json: { kind: 'message', source: 'telegram', client_chat_id: String(m.chat.id), current_message: text, received_at: new Date().toISOString(), telegram_username: String(m.from?.username || ''), sender_name: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') } }];`;

const ifWebsite = copy('If Callback');
Object.assign(ifWebsite, { name: 'If Website Link', id: 'ae385930-6580-4cc5-bb17-b076483fbe9c', position: [592, 1024] });
ifWebsite.parameters.conditions.conditions[0].id = '1b98f9df-8a77-49b0-b8a5-f68e2c5bff43';
ifWebsite.parameters.conditions.conditions[0].leftValue = '={{ $json.kind === "website_link" }}';

const wait = {
  parameters: { resume: 'timeInterval', amount: 4, unit: 'seconds' },
  type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [816, 944],
  id: 'a28869bc-98b8-47f4-802a-d3854cd42804', name: 'Wait for Website Lead',
  webhookId: '8e6e7cd8-3010-4f4b-890c-c24fa37ba821',
};

const getLead = copy('Get Existing Form Lead');
Object.assign(getLead, { name: 'Get Website Lead', id: '25bd3d28-608a-48aa-909d-febd26a3d8be', position: [1040, 944] });
getLead.parameters.filters.conditions = [{ keyName: 'request_id', keyValue: "={{ $('Parse Telegram Update').item.json.request_id }}" }];

const ifFound = copy('If Callback');
Object.assign(ifFound, { name: 'If Website Lead Found', id: '03ef93cb-b7b8-46e9-be24-b7ea6f75e944', position: [1264, 944] });
ifFound.parameters.conditions.conditions[0].id = '36ae90bc-956b-44ee-b290-87a7f7eb5eef';
ifFound.parameters.conditions.conditions[0].leftValue = '={{ Boolean($json.id) }}';

const attach = {
  parameters: { jsCode: "const link = $('Parse Telegram Update').item.json; return [{ json: { ...$json, linked_chat_id: link.client_chat_id } }];" },
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [1488, 880],
  id: 'f11b92ed-83b5-41ec-aacd-c1f5451a23ca', name: 'Attach Website Chat',
};

const updateChat = copy('Update Reschedule Lead');
Object.assign(updateChat, { name: 'Update Website Lead Chat', id: '1a6ad3b4-8504-4ec1-a3f5-0bca9f53b317', position: [1712, 880] });
updateChat.parameters.columns.value = { client_chat_id: '={{ $json.linked_chat_id }}' };

const linked = copy('Send AI Reply');
Object.assign(linked, { name: 'Confirm Website Link', id: 'cb87804d-481d-4d9f-b06a-73527125d8e1', position: [1936, 880] });
linked.parameters.chatId = "={{ $('Parse Telegram Update').item.json.client_chat_id }}";
linked.parameters.text = 'Готово! Я связала этот чат с заявкой с сайта. Администратор проверит время и пришлёт подтверждение сюда.';

const notFound = copy('Send AI Reply');
Object.assign(notFound, { name: 'Website Link Not Found', id: '9018f538-5775-453f-aa57-abf67a658c27', position: [1488, 1040] });
notFound.parameters.chatId = "={{ $('Parse Telegram Update').item.json.client_chat_id }}";
notFound.parameters.text = 'Заявка ещё обрабатывается. Пожалуйста, вернитесь на сайт и откройте ссылку Telegram ещё раз через несколько секунд.';

workflow.nodes.push(ifWebsite, wait, getLead, ifFound, attach, updateChat, linked, notFound);

workflow.connections['Website Gateway'] = { main: [[{ node: 'Normalize Form', type: 'main', index: 0 }]] };
workflow.connections['Parse Telegram Update'] = { main: [[{ node: 'If Website Link', type: 'main', index: 0 }]] };
workflow.connections['If Website Link'] = { main: [
  [{ node: 'Wait for Website Lead', type: 'main', index: 0 }],
  [{ node: 'If Callback', type: 'main', index: 0 }],
] };
workflow.connections['Wait for Website Lead'] = { main: [[{ node: 'Get Website Lead', type: 'main', index: 0 }]] };
workflow.connections['Get Website Lead'] = { main: [[{ node: 'If Website Lead Found', type: 'main', index: 0 }]] };
workflow.connections['If Website Lead Found'] = { main: [
  [{ node: 'Attach Website Chat', type: 'main', index: 0 }],
  [{ node: 'Website Link Not Found', type: 'main', index: 0 }],
] };
workflow.connections['Attach Website Chat'] = { main: [[{ node: 'Update Website Lead Chat', type: 'main', index: 0 }]] };
workflow.connections['Update Website Lead Chat'] = { main: [[{ node: 'Confirm Website Link', type: 'main', index: 0 }]] };

await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Built ${outputPath.pathname}`);
