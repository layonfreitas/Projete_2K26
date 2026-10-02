cloudflared tunnel --url http://localhost:8080 2>&1 | ForEach-Object {
  $line = $_.ToString()
  Write-Host $line
  if ($line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
    try {
      Invoke-RestMethod -Method Post `
        -Uri "https://coffeevison.projete2k26.workers.dev/_set" `
        -Headers @{ "x-secret" = "projete2k26senha" } `
        -Body $Matches[0] | Out-Null
      Write-Host ">> Worker atualizado com $($Matches[0])" -ForegroundColor Green
    } catch {
      Write-Host ">> FALHOU ao atualizar o Worker: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}