import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOperationalReporter } from '../../src/lib/operational-events';

test('operational hints are debounced per state and a failed sink never retries or rejects business work', async () => {
  const sent: string[] = []; let now = 1000;
  const report = createOperationalReporter(async event => { sent.push(event); throw new Error('sink offline'); }, () => now);
  report('updates.offline'); report('updates.offline'); report('updates.recovered');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, ['updates.offline', 'updates.recovered']);
  now += 60_000; report('updates.offline');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, ['updates.offline', 'updates.recovered', 'updates.offline']);
});
