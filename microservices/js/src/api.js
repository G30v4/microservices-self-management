const os = require('os');
const Consul = require('consul');
const express = require('express');

const app = express();

const CONSUL_HOST = process.env.CONSUL_HOST || 'consul';
const CONSUL_PORT = process.env.CONSUL_PORT || 8500;
const consul = new Consul({
  host: CONSUL_HOST,
  port: CONSUL_PORT
});

const PORT = process.env.PORT || 5000;
const SERVICE_NAME = process.env.SERVICE_NAME || "MyNodeService";
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const PYTHON_SERVICE_NAME = "MyPythonService"

function getHostIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
          if ('IPv4' === iface.family && !iface.internal) {
              console.log(`IP host ${iface.address}`);
              return iface.address;
          }
      }
  }
  return '127.0.0.1';
}

const hostIp = getHostIp();

async function getPythonServiceAddress() {
  const services = await consul.agent.service.list();
  const service = services[PYTHON_SERVICE_NAME];
  if (service) {
      return `${service.Address}:${service.Port}`;
  }
  throw new Error(`Servicio ${PYTHON_SERVICE_NAME} no encontrado en Consul`);
}


app.get('/healthcheck', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/info', async (req, res) => {
  try {
      const pythonServiceAddress = await getPythonServiceAddress();
      const response = await fetch(`http://${pythonServiceAddress}/info`);
      const data = await response.json();
      res.json({
          service_name: SERVICE_NAME,
          environment: ENVIRONMENT,
          python_info: data
      });
  } catch (error) {
      console.error('Error al obtener la info de Python:', error);
      res.status(500).json({ error: 'Error al obtener la info de Python' });
  }
});

(async () => {
  try {
      await consul.agent.service.register({
          name: SERVICE_NAME,
          address: hostIp,
          port: PORT,
          tags: ['nodejs', 'express'],
          check: {
              ttl: '10s',
              deregister_critical_service_after: '30s'
          }
      });
      console.log(`Servicio ${SERVICE_NAME} registrado en Consul con IP ${hostIp}`);

      setInterval(async () => {
          try {
              await consul.agent.check.pass({id: `service:${SERVICE_NAME}`});
              console.log(`Check de salud para ${SERVICE_NAME} pasado`);
          } catch (err) {
              console.error(`Error al actualizar el check de salud para ${SERVICE_NAME}:`, err);
          }
      }, 10 * 1000);

  } catch (err) {
      console.error('Error al registrar el servicio en Consul:', err);
  }
})();
process.on('uncaughtException', err => {
  console.error('Error no capturado:', err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
