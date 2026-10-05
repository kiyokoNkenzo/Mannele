# Mannele — private relationship notebook
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    PORT=8080

RUN useradd --create-home --uid 1000 mannele \
    && mkdir -p /data && chown mannele:mannele /data

WORKDIR /app
COPY app/ /app/

USER mannele
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/healthz', timeout=2)" || exit 1

CMD ["python", "server.py"]
