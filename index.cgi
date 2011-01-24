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
  map '/'
  engine :Erubis

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
  end

  def changes
    @pages = wiki.list(:sort_by => :modify_time).reverse! 
    @pager = paginate(@pages)
  end

  def list
    @pages = wiki.list
    #Ramaze::Log.debug pages.join(', ') 
    @pager = paginate(@pages)
  end

  def create(page)
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
    page = URI.decode page_uri.to_s
    page.force_encoding 'utf-8'
    
    if request['text']
      text = request['text'].to_s
      if text.empty?
        wiki.delete page_uri
        flash[:notice] = "#{page} を削除しました。"
        redirect r(:index)
      elsif wiki[page_uri] == text
        flash[:notice] = "内容が変更されていません。"
        redirect r(:edit, page_uri)
      else
        wiki[page_uri] = text
        flash[:notice] = "更新しました。"
        redirect r(:edit, page_uri)
      end
    else
        flash[:notice] = "テキストがありません。"
        redirect r(:edit, page_uri)
    end
  end

  def source(lib)
    wiki[lib].to_json
  end

end

DataDir = "data"

def wiki
  @wiki ||= Ramaziki.new(DataDir)
end

def parser
  @parser ||= Parser.new
end

if `hostname` =~ /starscream|Megatron/
  Ramaze.start
else
  Ramaze.start :port => 80
end
