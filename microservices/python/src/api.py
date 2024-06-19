import os
import consul
import logging
from fastapi import FastAPI
from src.utils import get_host_ip


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

consul_host = os.getenv("CONSUL_HOST", "consul")
consul_port = os.getenv("CONSUL_PORT", "8500")

logger.info(f"Params Consul: {consul_host, consul_port}")
consul_client = consul.Consul(host=consul_host, port=consul_port)

service_name = os.getenv("SERVICE_NAME", "MyPythonService")
service_port = 8000
service_tags = ["python", "microservice"]

host_ip = get_host_ip()

service_host = host_ip if host_ip else 'localhost'
logger.info(f"Dirección IP del host: {service_host}")

logger.info(f"Params APP: {service_name, service_host, service_port}")

@app.get("/healthcheck")
def healthcheck():
    return {"status": "ok"}

@app.get("/info")
def info():
    environment = os.getenv("ENVIRONMENT")
    return {"service_name": service_name, "environment": environment}

def register_service():
    logger.info("Registrando servicio en Consul.")
    consul_client.agent.service.register(
        service_name,
        service_id=service_name,
        address=service_host,
        port=service_port,
        tags=service_tags,
        check={
            "http": f"http://{service_host}:{service_port}/healthcheck",
            "interval": "10s" 
            }
    )

def deregister_service():
    logger.info("Deregistrando servicio de Consul.")
    consul_client.agent.service.deregister(service_id=service_name)

register_service()

@app.on_event("shutdown")
def shutdown_event():
    deregister_service()
    logger.info("Servicio detenido.")
