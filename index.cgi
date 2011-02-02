# -*- coding: utf-8 -*-
require 'rubygems'
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
  include Ramaze
  map '/'
  engine :Erubis
  layout :default
  set_layout_except :default => [:edit, :source, :modify]

  helper :paginate
  helper :ramazikihelper
  
  Ramaze::Log.start
  Ramaze::Log.debug "start"
  Ramaze::Log.level = Innate::LogHub::DEBUG
  Ramaze::Log.debug Ramaze::Log.level
  trait :paginate => {
    :limit => 20,
    :var => 'page',
  }

  def index
    @title = "Rubiki トップページ"
  end

  def changes
    @title = "ページリスト (新着順)"
    @pages = wiki.list(:sort_by => :modify_time).reverse! 
    @pager = paginate(@pages)
  end

  def list
    @title = "ページリスト (ABC順)"
    @pages = wiki.list
    #Ramaze::Log.debug pages.join(', ') 
    @pager = paginate(@pages)
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
    @title = "#{@page} の編集"
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

end

$dataDir = ARGV[0] || "data"

def wiki
  @wiki ||= Ramaziki.new($dataDir)
end

def parser
  @parser ||= Parser.new
end

if `hostname` =~ /starscream|Megatron/
  Ramaze.start
else
  Ramaze.start :port => 80
end
