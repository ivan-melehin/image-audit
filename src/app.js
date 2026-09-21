import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runAudit } from './audit/runAudit.js';

const PORT = 3000;
const jobs = new Map();

// Определяем путь к корню проекта.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, '..', 'index.html');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Открываем веб-интерфейс.
  if (req.method === 'GET' && req.url === '/') {
    try {
      const html = await fs.readFile(indexPath, 'utf8');

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });

      res.end(html);
    } catch (error) {
      console.error(error);

      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8'
      });

      res.end('Не удалось загрузить index.html');
    }

    return;
  }

  // Проверяем работу сервера.
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8'
    });

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
        res.writeHead(400, {
          'Content-Type': 'application/json; charset=utf-8'
        });

        res.end(JSON.stringify({
          error: 'URL сайта не указан'
        }));

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

      // Запускаем аудит в фоне.
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

      res.writeHead(202, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        jobId,
        status: 'running'
      }));
    } catch (error) {
      console.error(error);

      res.writeHead(400, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        error: 'Некорректный запрос'
      }));
    }

    return;
  }

  // Скачиваем Excel-отчёт.
  if (req.method === 'GET' && req.url.startsWith('/api/audit/') && req.url.endsWith('/report')) {
    const parts = req.url.split('/');
    const jobId = parts[3];
    const job = jobs.get(jobId);

    if (!job) {
      res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        error: 'Аудит не найден'
      }));

      return;
    }

    if (job.status !== 'completed' || !job.result?.auditReportPath) {
      res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        error: 'Отчёт ещё не готов'
      }));

      return;
    }

    try {
      const reportPath = job.result.auditReportPath;
      const report = await fs.readFile(reportPath);

      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="image-audit-report.xlsx"',
        'Content-Length': report.length
      });

      res.end(report);
    } catch (error) {
      console.error('Ошибка загрузки отчёта:', error);

      res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        error: 'Не удалось загрузить отчёт'
      }));
    }

    return;
  }

  // Получаем статус аудита.
  if (req.method === 'GET' && req.url.startsWith('/api/audit/')) {
    const jobId = req.url.split('/').pop();
    const job = jobs.get(jobId);

    if (!job) {
      res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        error: 'Аудит не найден'
      }));

      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify(job));
    return;
  }

  // Возвращаем ошибку для неизвестного маршрута.
  res.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8'
  });

  res.end(JSON.stringify({
    error: 'Маршрут не найден'
  }));
});

server.listen(PORT, () => {
  console.log('\nImage Audit server запущен:');
  console.log(`http://localhost:${PORT}`);
});