# -*- coding: utf-8 -*-
#require "#{File.dirname(__FILE__)}/vendor/gems/environment"
require 'ramaze'
require 'erb'
require 'json'

if RUBY_VERSION == "1.9.0"
alias :require_relative :require
end

require_relative 'ramaziki'
require_relative 'parser'
require_relative 'ramaziki_helper'

class RamazikiController < Ramaze::Controller
case `hostname`
when /Megatron/
  Ruby1_9_0 = "/opt/local/bin/ruby1.9.0"
#when /starscream/
when /www17235u/  
  Ruby1_9_0 = "/usr/local/bin/ruby1.9.0"
else
end
  include Ramaze
  map '/'
  engine :Erubis
  layout :default
  set_layout_except :default => [:edit, :source, :modify, :compile_ruby, :require]

  helper :paginate
  helper :ramazikihelper
  
  Ramaze::Log.start
  Ramaze::Log.debug "start"
  Ramaze::Log.level = Innate::LogHub::DEBUG
  Ramaze::Log.debug Ramaze::Log.level

  def index
    @title = "Rubiki トップページ"
  end

  def changes
    @title = "ページリスト (新着順)"
    @pager = wiki.list(:sort_by => :modify_time).reverse! 
  end

  def list
    @title = "ページリスト (ABC順)"
    @pager = wiki.list
  end

  def create(page)
    @title = "新しくページをつくる"
  end

  def edit(page = nil)
    page ||= request['page']
    unless page
      flash[:error] = "ページが指定されていません。"
      Ramaze::Log.debug redirect r(:index)
    end
    @text = wiki[page]
    @page = url_decode page.to_s
    @page.force_encoding 'utf-8'
    @title = @page
  end

  def modify(page_uri)
    if request['text']
      text = request['text'].to_s
      text = URI.decode text
      text.force_encoding "UTF-8"
      if text.empty?
        wiki.delete page_uri
        page = URI.decode page_uri.to_s
        page.force_encoding 'utf-8'
        flash[:notice] = "#{page} を削除しました。"
        redirect r(:index)
      elsif wiki[page_uri] == text
        "内容が変更されていません。"
      else
        wiki[page_uri] = text
        "更新しました。"
      end
    else
        "テキストがありません。"
    end
    
  end

  def source(lib)
    wiki[lib].to_json
  end
  
  def compile_ruby(page)
    src = url_decode request['src']
    if src.empty?
      ["Empty Source Code!"].to_json
    else
      begin
        opcodes = compile(page, src)
        u opcodes[0]
      rescue SyntaxError
        u $!
      rescue
        u $!
      end
    end
  end
  
  def require(lib)
    page = html_unescape lib
    src = wiki[page]
    if src.empty?
      ["Empty Source Code!"].to_json
    else
      begin
        opcodes = compile(page, src)
        u opcodes[0]
      rescue SyntaxError
        u $!
      rescue
        u $!
      end
    end
  end

  private
  def compile(page, src)
    IO.popen("#{Ruby1_9_0} ./compile.rb '#{page}' ", 'r+') do |io|
      io.puts src
      io.close_write
      io.readlines
    end
  end

end

$dataDir = "data"

def wiki
  @wiki ||= Ramaziki.new($dataDir)
end

def parser
  @parser ||= Parser.new
end

