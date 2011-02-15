# coding: utf-8

app_dir = File.expand_path(File.dirname(__FILE__))
$LOAD_PATH << app_dir
require 'rubiki'
run RamazikiController.new
