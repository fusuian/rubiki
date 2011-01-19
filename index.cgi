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

  def home
  end

  def news
    @pages = wiki.list(:sort_by => :modify_time).reverse! 
    @pager = paginate(@pages)
  end

  def index(mode = "")
    @pages = wiki.list
    #Ramaze::Log.debug pages.join(', ') 
    @pager = paginate(@pages)
  end

  def create(page)
  end

  def edit(page = nil)
    @content = page
    page ||= request['page']
    Ramaze::Log.debug "page: #{page}: encoding=#{page.encoding}"
    

    unless page
      flash[:error] = "ページが指定されていません。"
      redirect r(:home)
    end
    @page = url_decode page.to_s
    @page.force_encoding 'utf-8'
    Ramaze::Log.debug "page: #{@page}: encoding=#{@page.encoding}"
    @text = wiki[@page]
    @title = "#{@page} の編集"
    response["Access-Control"] = "allow <*>"

  end

  def modify(page_uri)
    page = URI.decode page_uri.to_s
    page.force_encoding 'utf-8'
    
    if request['text']
      text = request['text'].to_s
      if text.empty?
        wiki.delete page_uri
        flash[:notice] = "#{page} を削除しました。"
        redirect r(:home)
      elsif wiki[page] == text
        flash[:notice] = "内容が変更されていません。"
        redirect r(:edit, page_uri)
      else
        wiki[page] = text
        flash[:notice] = "更新しました。"
        redirect r(:edit, page_uri)
      end
    else
        flash[:notice] = "テキストがありません。"
        redirect r(:show, page_uri)
    end
  end

  def require
    lib = html_unescape request['lib']
    compile(lib, parse(wiki[lib])).to_json
  end

  if false
    def compile_ruby(page)
    Ramaze::Log.debug "compile_ruby"
    Ramaze::Log.debug request.inspect
    src = url_decode request['src']
    #        opcodes = compile(page, parse(src))
    #        Ramaze::Log.debug "opcode = <#{opcodes}>"
    #        return opcodes.to_json
    Ramaze::Log.debug "src = <#{src}>"
    if src.empty?
      "Empty Source Code!"
    else
      begin
        Ramaze::Log.debug "parse <#{parse(src)}>"
        opcodes = compile(page, parse(src))
        Ramaze::Log.debug "opcode = <#{opcodes}>"
        url_encode opcodes.to_json
      rescue SyntaxError
        Ramaze::Log.debug "SyntaxError"
        url_encode $!.to_json
      rescue
        Ramaze::Log.debug "UnsupportedError"
        url_encode $!.to_json
      end
    end
  end
  
  def require
    lib = html_unescape request['lib']
    compile(lib, parse(wiki[lib])).to_json
  end
  
  private
  OutputCompileOption = {
  :peephole_optimization    =>true,
  :inline_const_cache       =>false,
  :specialized_instruction  =>false,
  :operands_unification     =>false,
  :instructions_unification =>false,
  :stack_caching            =>false,
  }

  def compile(page, src)
    begin
      myerr = StringIO.open
      $stderr = myerr
      if RUBY_VERSION == "1.9.0"
        VM::InstructionSequence.compile(src, page, 1, OutputCompileOption).to_a
      else
        RubyVM::InstructionSequence.compile(src, page, nil, 1, OutputCompileOption).to_a
      end
    rescue SyntaxError
      myerr.rewind
      raise $!, myerr.read
    rescue 
      myerr.rewind
      raise $!, myerr.read
    ensure
      myerr.close
      $stderr = STDERR
    end
  end
  
  # コンパイルの前にソースを解析する。
  # 1.attr_* を setter/getter に書き換える。
  def parse(src)
    src.gsub!(/attr_reader (:(\w+),*\s*)*/) {
      "#{getter($2)}\n"
    }
    src.gsub!(/attr_writer (:(\w+),*\s*)*/) { 
      "#{setter($2)}\n"
    }
    src.gsub!(/attr_accessor (:(\w+),*\s*)*/) { 
      "#{getter($2)}#{setter($2)}\n"
    }
    src
  end

  def getter(s)
      %Q(  def #{s}; @#{s}; end; ) 
  end
  
  def setter(s)
      %Q(  def #{s}=(v); @#{s} = v; end; ) 
  end
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
