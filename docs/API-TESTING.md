# API Testing Notes

Run the app in one terminal:

```bash
npm start
```

In a second terminal, use PowerShell examples below.

## Health

```powershell
Invoke-RestMethod http://localhost:3000/health
```

## Generate report

```powershell
$body = @{} | ConvertTo-Json
$result = Invoke-RestMethod -Method Post -Uri http://localhost:3000/reports -ContentType "application/json" -Body $body
$result | ConvertTo-Json -Depth 5
```

## Download report

```powershell
Invoke-WebRequest "http://localhost:3000$($result.file)" -OutFile ".\my-report.pdf"
```

## Verify idempotency

```powershell
$first = Invoke-RestMethod -Method Post -Uri http://localhost:3000/reports -ContentType "application/json" -Body "{}"
$second = Invoke-RestMethod -Method Post -Uri http://localhost:3000/reports -ContentType "application/json" -Body "{}"
$first.id
$second.id
```

The two IDs should match on the same server calendar day.

## Force a fresh report

```powershell
$forced = Invoke-RestMethod -Method Post -Uri http://localhost:3000/reports -ContentType "application/json" -Body '{"force":true}'
$forced.id
```
