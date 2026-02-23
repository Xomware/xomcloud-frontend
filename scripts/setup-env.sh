#!/bin/bash
# Generate environment.ts from environment variables or copy from example
ENV_FILE="src/environments/environment.ts"
EXAMPLE_FILE="src/environments/environment.example.ts"

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE from example..."
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "⚠️  Edit $ENV_FILE with your local values or set CI/CD env vars."
fi
