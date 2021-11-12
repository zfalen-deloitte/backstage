#!/bin/bash

# Copyright 2020 The Backstage Authors
# #
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

# Build techdocs-cli
npx backstage-cli -- build --outputs cjs

# Build embedded-techdocs-app
pushd ../embedded-techdocs-app 

if [ "$TECHDOCS_CLI_DEV_MODE" = "true" ] ; then
  yarn build:dev
else
  yarn build
fi

# Copy the built-in app to the package
cp -r dist ../techdocs-cli/dist/techdocs-preview-bundle
 
# Go back to techdocs-cli dir
popd 

echo "[techdocs-cli]: Built the dist/ folder"
echo "[techdocs-cli]: Imported @backstage/plugin-techdocs dist/ folder into techdocs-preview-bundle/"
