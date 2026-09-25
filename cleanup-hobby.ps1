# Execute na raiz do projeto ANTES de copiar os arquivos compactos.
# Remove apenas os endpoints antigos que viraram uma única função /api/exam.js
# e os helpers que foram movidos para /lib.

Remove-Item -Recurse -Force ".\api\exam" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\api\_lib" -ErrorAction SilentlyContinue

# MCP foi abandonado porque sua conta ChatGPT Plus não usa custom MCP.
# Remover economiza mais 3 Serverless Functions.
Remove-Item -Force ".\api\mcp.js" -ErrorAction SilentlyContinue
Remove-Item -Force ".\api\mcp-health.js" -ErrorAction SilentlyContinue
Remove-Item -Force ".\api\oauth-protected-resource.js" -ErrorAction SilentlyContinue

Write-Host "Limpeza concluida."
