'use strict';
const model = require('./job-model.js');
function parseBody(body) {
  const begin = '<!-- SARAI_JOB_REQUEST_V1 -->\n```base64\n';
  const end = '\n```\n<!-- END_SARAI_JOB_REQUEST -->';
  if (typeof body !== 'string' || body.length > 12000) throw new Error('Invalid job request body');
  const first = body.indexOf(begin);
  const last = body.lastIndexOf(end);
  if (first < 0 || last <= first || body.slice(last + end.length).trim()) throw new Error('Missing job request');
  const encoded = body.slice(first + begin.length, last);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid job request encoding');
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
function applyRequest(source, payload, identity, now = new Date().toISOString()) {
  if (!identity || identity.ownerLogin !== 'sarai-kz' || identity.repository !== 'sarai-kz/sarai' || identity.actor !== identity.ownerLogin || identity.ownerId !== 345260523 || identity.authorId !== identity.ownerId || identity.authorLogin !== identity.ownerLogin) throw new Error('Only the repository owner may publish jobs');
  if (!Number.isSafeInteger(identity.issueNumber) || identity.issueNumber < 1) throw new Error('Invalid request number');
  if (!payload || Array.isArray(payload) || Object.keys(payload).some(key => !['version', 'action', 'expected_updated_at', 'job'].includes(key)) || payload.version !== 1 || payload.action !== 'upsert') throw new Error('Invalid request action');
  if (payload.job && Object.keys(payload.job).some(key => !model.fields.includes(key))) throw new Error('Unexpected request field');
  const clean = model.request(payload.job, payload.expected_updated_at);
  const feed = model.feed(source);
  const index = feed.jobs.findIndex(item => item.id === clean.job.id);
  const current = index < 0 ? null : feed.jobs[index];
  if (current && current.last_request === identity.issueNumber) return {feed, changed: false};
  if (model.revision(current) !== clean.expected_updated_at) throw new Error('The job changed. Reload the management page before editing again.');
  if (!current && feed.jobs.length >= 500) throw new Error('Job limit reached');
  if (current && current.published_at !== clean.job.published_at) throw new Error('Publication date must be preserved');
  const record = model.job({...clean.job, updated_at: now, last_request: identity.issueNumber});
  if (current) feed.jobs[index] = record;
  else feed.jobs.push(record);
  return {feed: model.feed(feed), changed: true};
}
async function main() {
  const fs = require('node:fs');
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const owner = event.repository.owner;
  const issue = event.issue;
  if (event.action !== 'opened' || !issue.title.startsWith('[SARAI] Тапсырыс')) throw new Error('Unsupported event');
  const identity = {ownerLogin: owner.login, ownerId: owner.id, authorId: issue.user.id, authorLogin: issue.user.login, actor: process.env.GITHUB_ACTOR, repository: process.env.GITHUB_REPOSITORY, issueNumber: issue.number};
  const payload = parseBody(issue.body);
  applyRequest({version: 1, jobs: []}, {...payload, expected_updated_at: null}, identity);
  if (!process.env.GH_TOKEN) throw new Error('Missing repository token');
  const url = 'https://api.github.com/repos/sarai-kz/sarai/contents/data/jobs.json';
  const headers = {'Authorization': 'Bearer ' + process.env.GH_TOKEN, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'SARAI-Jobs'};
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url + '?ref=main', {headers});
    if (!response.ok) throw new Error('Could not read job list: HTTP ' + response.status);
    const file = await response.json();
    const result = applyRequest(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), payload, identity);
    if (!result.changed) return;
    const save = await fetch(url, {method: 'PUT', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify({message: 'Update SARAI job from owner request #' + issue.number, branch: 'main', sha: file.sha, content: Buffer.from(JSON.stringify(result.feed, null, 2) + '\n').toString('base64')})});
    if (save.ok) { console.log('Owner job request #' + issue.number + ' saved.'); return; }
    if (![409, 422].includes(save.status) || attempt === 3) throw new Error('Could not save job list: HTTP ' + save.status);
  }
}
module.exports = {parseBody, applyRequest, main};
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
