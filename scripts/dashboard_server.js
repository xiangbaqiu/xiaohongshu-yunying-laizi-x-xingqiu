#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const { buildDashboardData } = require('./build_dashboard_data');
const { createPublishReady } = require('../src/publish_ready_builder');
const { recordPublishResult } = require('../src/publish_record_store');
const { updateDraftReviewStatus } = require('../src/review_action_store');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, contentType, body) {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function serveStatic(projectRoot, pathname, res) {
  let filePath = null;

  if (pathname === '/') {
    res.writeHead(302, { Location: '/dashboard/index.html' });
    res.end();
    return true;
  }

  if (pathname.startsWith('/dashboard/')) {
    filePath = path.join(projectRoot, pathname.slice(1));
  } else if (pathname.startsWith('/data/')) {
    filePath = path.join(projectRoot, pathname.slice(1));
  }

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  sendText(res, 200, getContentType(filePath), fs.readFileSync(filePath));
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createDashboardServer(projectRoot) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/api/dashboard-data') {
      try {
        const { dashboard } = buildDashboardData(projectRoot);
        return sendJson(res, 200, dashboard);
      } catch (error) {
        return sendJson(res, 500, { ok: false, message: error.message });
      }
    }

    if (req.method === 'POST' && /^\/api\/drafts\/[^/]+\/review-status$/.test(url.pathname)) {
      try {
        const draftId = decodeURIComponent(url.pathname.split('/')[3]);
        const body = await readBody(req);
        const { draft, previousStatus } = updateDraftReviewStatus(projectRoot, {
          draftId,
          reviewStatus: body.review_status,
          reviewerNote: body.reviewer_note,
          editSuggestion: body.edit_suggestion,
          rejectionReason: body.rejection_reason,
          operatorIdentity: body.operator_identity,
          source: 'dashboard'
        });
        const { dashboard } = buildDashboardData(projectRoot);
        return sendJson(res, 200, {
          ok: true,
          draft_id: draftId,
          previous_review_status: previousStatus,
          review_status: draft.review_status,
          review_annotation: draft.review_annotation || null,
          review_updated_at: draft.review_updated_at,
          dashboard_generated_at: dashboard.generated_at
        });
      } catch (error) {
        return sendJson(res, 400, { ok: false, message: error.message });
      }
    }

    if (req.method === 'POST' && /^\/api\/drafts\/[^/]+\/publish-ready$/.test(url.pathname)) {
      try {
        const draftId = decodeURIComponent(url.pathname.split('/')[3]);
        const body = await readBody(req);
        const { publishReady, filePath } = createPublishReady(projectRoot, {
          draftId,
          preparedBy: body.operator_identity
        });
        const { dashboard } = buildDashboardData(projectRoot);
        return sendJson(res, 200, {
          ok: true,
          draft_id: draftId,
          publish_ready_id: publishReady.publish_ready_id,
          prepared_at: publishReady.prepared_at,
          prepared_by: publishReady.prepared_by,
          artifact_path: path.relative(projectRoot, filePath),
          dashboard_generated_at: dashboard.generated_at
        });
      } catch (error) {
        return sendJson(res, 400, { ok: false, message: error.message });
      }
    }

    if (req.method === 'POST' && /^\/api\/drafts\/[^/]+\/publish-record$/.test(url.pathname)) {
      try {
        const draftId = decodeURIComponent(url.pathname.split('/')[3]);
        const body = await readBody(req);
        const { draft, publishRecord, publishRecordPath } = recordPublishResult(projectRoot, {
          draftId,
          publishedBy: body.operator_identity,
          publishedAt: body.published_at,
          platformUrl: body.platform_url,
          platformPostId: body.platform_post_id,
          note: body.publish_note,
          source: 'dashboard'
        });
        const { dashboard } = buildDashboardData(projectRoot);
        return sendJson(res, 200, {
          ok: true,
          draft_id: draftId,
          review_status: draft.review_status,
          publish_record_id: publishRecord.publish_record_id,
          published_at: publishRecord.published_at,
          published_by: publishRecord.published_by,
          platform_post_url: publishRecord.platform_post_url,
          artifact_path: path.relative(projectRoot, publishRecordPath),
          dashboard_generated_at: dashboard.generated_at
        });
      } catch (error) {
        return sendJson(res, 400, { ok: false, message: error.message });
      }
    }

    if (req.method === 'GET' && serveStatic(projectRoot, url.pathname, res)) {
      return;
    }

    sendJson(res, 404, { ok: false, message: 'Not found' });
  });
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const port = Number(process.env.PORT || 8008);

  buildDashboardData(projectRoot);

  const server = createDashboardServer(projectRoot);
  server.listen(port, () => {
    console.log(`Dashboard server running at http://127.0.0.1:${port}/dashboard/index.html`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createDashboardServer
};
