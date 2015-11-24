#
# Cookbook Name:: cookbook
# Recipe:: default
#
# Copyright (c) 2015 The Authors, All Rights Reserved.
#
#

execute 'update apt repositories' do
  command 'apt-get update'
end

package 'git'

package 'redis-server'

service 'redis-server' do
  supports :status => true
  action [:enable, :start]
end

package 'nginx'

file '/etc/nginx/sites-enabled/default' do
  action :delete
end

file '/etc/nginx/sites-available/default' do
  action :delete
end

template '/etc/nginx/sites-available/replicator' do
  source 'replicator.erb'
end

link '/etc/nginx/sites-enabled/replicator' do
  to '/etc/nginx/sites-available/replicator'
end

service 'nginx' do
  supports :status => true
	action [:enable, :start]
end

execute 'add node package repo' do
  command 'curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -'
end

execute 'install node' do
  command 'apt-get install -y nodejs'
end

execute 'install pm2' do
  command 'npm install -g pm2'
end

directory '/srv/www/featureservice-replicator' do
  mode '0755'
  action :create
  recursive true
end

execute 'install featureservice-replicator' do
  cwd '/srv/www'
  command 'git clone http://github.com/dmfenton/featureservice-replicator.git'
end

execute 'install dependencies' do
  cwd '/srv/www/featureservice-replicator'
  command 'npm install --production'
end

