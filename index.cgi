# -*- coding: utf-8 -*-
require_relative 'rubiki'

if `hostname` =~ /starscream|Megatron/
  Ramaze.start
else
  Ramaze.start :port => 80
end
