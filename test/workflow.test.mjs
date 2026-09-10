import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const file = new URL('../workflow/Vektor-Auto-V2.3-Website-Demo.json', import.meta.url);

test('website workflow accepts protected leads and links them to Telegram', async () => {
  const workflow = JSON.parse(await readFile(file, 'utf8'));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));

  assert.equal(workflow.name.includes('V2.3'), true);
  assert.equal(nodes.get('Website Gateway').parameters.authentication, 'headerAuth');
  assert.equal(nodes.get('Website Gateway').parameters.path, 'vektor-auto-lead');
  assert.match(nodes.get('Normalize Form').parameters.jsCode, /body/);
  assert.match(nodes.get('Validate Form AI').parameters.jsCode, /request_id/);
  assert.equal(nodes.get('Get Website Lead').parameters.filters.conditions[0].keyName, 'request_id');
  assert.equal(nodes.get('Update Website Lead Chat').parameters.columns.value.client_chat_id.includes('linked_chat_id'), true);
  assert.equal(workflow.connections['Parse Telegram Update'].main[0][0].node, 'If Website Link');
  assert.equal(workflow.connections['If Website Link'].main[1][0].node, 'If Callback');
  assert.equal(JSON.stringify(workflow).includes('N8N_WEBHOOK_TOKEN'), false);
});
