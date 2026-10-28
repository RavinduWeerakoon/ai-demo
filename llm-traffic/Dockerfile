# Standard library only: no dependencies to install.
FROM python:3.12-slim
WORKDIR /app
COPY conversations.py traffic.py ./
# Fixed non-root UID so the pod's runAsNonRoot check passes.
USER 10001
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
CMD ["python", "traffic.py"]
