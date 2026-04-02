$path = "c:\Users\hustl\Downloads\New folder\gravity-claw\src\bot\telegram.ts"
$content = Get-Content -Path $path -Raw

$fixes = @{
    'Ã¢Â Å’' = '❌'
    'â ³' = '⏳'
    'Ã°Å¸â€œÂ¡' = '📡'
    'ðŸ”„' = '🔄'
    'Ã°Å¸â€™Â°' = '💰'
    'Ã°Å¸â€œâ€°' = '📉'
    'Ã¢Å¡Â Ã¯Â¸Â ' = '⚠️'
    'Ã°Å¸â€œÅ ' = '📊'
    'Ã¢â€ Â' = '━'
    'Ã°Å¸Â¤â€“' = '🤖'
    'Ã°Å¸â€œâ€š' = '📁'
    'Ã°Å¸â€œâ€ž' = '📄'
    'Ã°Å¸â€œÂ§' = '📧'
    'Ã°Å¸â€œâ€¦' = '📅'
    'Ã°Å¸Å’Â ' = '🌍'
    'Ã°Å¸â€ Â ' = '🔎'
    'Ã°Å¸Â§Â¹' = '🧹'
    'Ã°Å¸Å½Â¯' = '🎯'
    'Ã°Å¸Å¸Â¢' = '🟢'
    'Ã°Å¸â€œÂ­' = '📭'
    'Ã°Å¸â€œâ€¹' = '📋'
    'Ã¢â­ ' = '⭐'
    'Ã°Å¸Â§Â' = '🧠'
}

foreach ($key in $fixes.Keys) {
    $content = $content.Replace($key, $fixes[$key])
}

# Ensure the file is saved as UTF8
[io.file]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
