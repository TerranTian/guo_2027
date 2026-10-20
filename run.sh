#!/usr/bin/env bash
#
# Author: Terran Tian
# Email: terran.tian@foxmail.com
#

set -euo pipefail

dir=$(cd "$(dirname "$0")" && pwd)
tmp="$dir/.tmp" && mkdir -p "$tmp"

env_file="$dir/.env"
if [ -f "$env_file" ]; then
	set -a ;source "$env_file";set +a;
fi

app_name="guo_2027"
s3_dir="s3://game/$app_name"

function error_exit() {
	echo "【ERROR】::${1:-Unknown Error}" >&2
	exit 1
}

function s3(){
	aws s3 --profile seastar "$@"
}

function build() {
	local upload=false
	while [ "$#" -gt 0 ]; do
		case "$1" in
			-u | --upload) upload=true ;;
			*) error_exit "unknown build argument: $1 (usage: build [-u|--upload])" ;;
		esac
		shift
	done
	
	# Relative URLs allow the same output to run under content/ or a domain root.
	(cd "$dir" && npm run build -- --base=./) || error_exit "React build failed"

	local dist="$dir/dist"
	if [ "$upload" = true ]; then
		s3 cp "$dist/" "$s3_dir/content/" --recursive || error_exit "S3 upload failed"
	fi
	echo "Build complete: $dist"
}


function format_code(){
	for file in `find $dir/src -name "*.ts" -o -name "*.js" -o -name "*.tsx"`;do 
		prettier -w $file --config $dir/.prettierrc;  
	done
}


if test $# -lt 1; then error_exit "wrong arguments"; fi
cmd=$1 && shift
declare -F "$cmd" >/dev/null || error_exit "unknown command: $cmd"
echo "$cmd $*"
"$cmd" "$@"
