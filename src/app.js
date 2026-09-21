import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { runAudit } from './audit/runAudit.js';

const PORT = 3000;
const jobs = new Map();

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Проверяем работу сервера.
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Запускаем новый аудит.
  if (req.method === 'POST' && req.url === '/api/audit') {
    try {
      let body = '';

      for await (const chunk of req) {
        body += chunk;
      }

      const data = JSON.parse(body);

      if (!data.url) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'URL сайта не указан' }));
        return;
      }

      const jobId = randomUUID();

      jobs.set(jobId, {
        status: 'running',
        url: data.url,
        result: null,
        error: null
      });

      console.log(`\nЗапущен аудит: ${data.url}`);
      console.log(`Job ID: ${jobId}`);

      // Запускаем аудит в фоне, не ожидая его завершения.
      runAudit(data.url)
        .then(result => {
          jobs.set(jobId, {
            status: 'completed',
            url: data.url,
            result,
            error: null
          });

          console.log(`Аудит завершён: ${jobId}`);
        })
        .catch(error => {
          jobs.set(jobId, {
            status: 'failed',
            url: data.url,
            result: null,
            error: error.message
          });

          console.error(`Ошибка аудита ${jobId}:`, error);
        });

      res.writeHead(202);
      res.end(JSON.stringify({
        jobId,
        status: 'running'
      }));
    } catch (error) {
      console.error(error);
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'Некорректный запрос'
      }));
    }

    return;
  }

  // Получаем статус аудита.
  if (req.method === 'GET' && req.url.startsWith('/api/audit/')) {
    const jobId = req.url.split('/').pop();
    const job = jobs.get(jobId);

    if (!job) {
      res.writeHead(404);
      res.end(JSON.stringify({
        error: 'Аудит не найден'
      }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(job));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({
    error: 'Маршрут не найден'
  }));
});

server.listen(PORT, () => {
  console.log('\nImage Audit server запущен:');
  console.log(`http://localhost:${PORT}`);
});