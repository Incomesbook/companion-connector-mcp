$cmds=@('pdftoppm','magick','gswin64c','7z','unrar')
$out=@()
foreach($c in $cmds){
  $x=Get-Command $c -ErrorAction SilentlyContinue
  $p=$null
  if($x){$p=$x.Source}
  $out += [pscustomobject]@{Command=$c;Found=[bool]$x;Path=$p}
}
$out | ConvertTo-Json -Depth 4
