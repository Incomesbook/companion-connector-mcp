$cmds=@('ffmpeg','ffprobe','yt-dlp','tesseract','python','node','ollama')
$out=@()
foreach($c in $cmds){
  $x=Get-Command $c -ErrorAction SilentlyContinue
  $out += [pscustomobject]@{Command=$c;Found=[bool]$x;Path=if($x){$x.Source}else{$null}}
}
$out | ConvertTo-Json -Depth 4
