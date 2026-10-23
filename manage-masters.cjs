'use strict';
const model = require('./master-model.js');
const BEGIN = '<!-- SARAI_MASTER_REQUEST_V2 -->\n```json\n';
const END = '\n```\n<!-- END_SARAI_MASTER_REQUEST -->';

function parseBody(body) {
  if (typeof body !== 'string' || body.length > 6000) throw new Error('Invalid request body');
  const begin = body.indexOf(BEGIN);
  const end = body.lastIndexOf(END);
  if (begin < 0 || end <= begin || body.slice(end + END.length).trim()) throw new Error('Missing master request');
  return JSON.parse(body.slice(begin + BEGIN.length, end));
}

function applyRequest(source, payload, identity, now = new Date().toISOString()) {
  if (!identity || identity.ownerLogin !== 'sarai-kz' || identity.repository !== 'sarai-kz/sarai' || identity.actor !== identity.ownerLogin || !Number.isSafeInteger(identity.ownerId) || identity.ownerId <= 0 || identity.authorId !== identity.ownerId || identity.authorLogin !== identity.ownerLogin) throw new Error('Only the repository owner may publish masters');
  if (!Number.isSafeInteger(identity.issueNumber) || identity.issueNumber < 1) throw new Error('Invalid request number');
  if (!payload || Object.keys(payload).some(key => !['version', 'action', 'expected_updated_at', 'master'].includes(key)) || payload.version !== 2 || payload.action !== 'upsert') throw new Error('Invalid request action');
  const feed = model.feed(source);
  const nextMaster = model.master(payload.master);
  const index = feed.masters.findIndex(record => record.id === nextMaster.id);
  const current = index >= 0 ? feed.masters[index] : null;
  if (current && current.last_request === identity.issueNumber) return {feed, changed: false};
  if ((current ? current.updated_at : null) !== payload.expected_updated_at) throw new Error('The master changed. Reload the management page before editing again.');
  if (feed.masters.some(record => record.id !== nextMaster.id && record.trade === nextMaster.trade && record.name.toLowerCase() === nextMaster.name.toLowerCase() && record.description === nextMaster.description)) throw new Error('This master already exists');
  if (!current && feed.masters.length >= 500) throw new Error('Master limit reached');
  const record = {...nextMaster, updated_at: now, last_request: identity.issueNumber};
  if (current) feed.masters[index] = record;
  else feed.masters.push(record);
  return {feed: model.feed(feed), changed: true};
}

async function main() {
  const fs = require('node:fs');
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const owner = event.repository.owner;
  const issue = event.issue;
  const identity = {ownerLogin: owner.login, ownerId: owner.id, authorId: issue.user.id, authorLogin: issue.user.login, actor: process.env.GITHUB_ACTOR, repository: process.env.GITHUB_REPOSITORY, issueNumber: issue.number};
  if (event.action !== 'opened' || !issue.title.startsWith('[SARAI] Шебер')) throw new Error('Unsupported event');
  const payload = parseBody(issue.body);
  // Authorize and validate before making any authenticated API request.
  applyRequest({version: 2, masters: []}, {...payload, expected_updated_at: null}, identity);
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('Missing repository token');
  const url = 'https://api.github.com/repos/sarai-kz/sarai/contents/masters.json';
  const headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'SARAI-Masters'};
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url + '?ref=main', {headers});
    if (!response.ok) throw new Error('Could not read master list: HTTP ' + response.status);
    const file = await response.json();
    const source = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    const result = applyRequest(source, payload, identity);
    if (!result.changed) {
      console.log('This owner request was already applied.');
      return;
    }
    const save = await fetch(url, {method: 'PUT', headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify({message: 'Update SARAI masters from owner request #' + issue.number, branch: 'main', sha: file.sha, content: Buffer.from(JSON.stringify(result.feed, null, 2) + '\n').toString('base64')})});
    if (save.ok) {
      console.log('Owner request #' + issue.number + ' saved.');
      return;
    }
    if (![409, 422].includes(save.status) || attempt === 3) throw new Error('Could not save master list: HTTP ' + save.status);
  }
}

module.exports = {parseBody, applyRequest};
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});

