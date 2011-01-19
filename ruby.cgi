# -*- coding: utf-8 -*-
require 'rubygems'
require 'ramaze'
require 'erb'
require 'json'

if RUBY_VERSION == "1.9.0"
alias :require_relative :require
end

class RamazikiController < Ramaze::Controller
  map '/'

  helper :paginate
  
  Ramaze::Log.start
  Ramaze::Log.debug "start"
  Ramaze::Log.level = Innate::LogHub::DEBUG
  Ramaze::Log.debug Ramaze::Log.level

  def index
    Ramaze::Log.debug "index"
    "ruby.cgi index"
  end

    def compile_ruby(page)
    Ramaze::Log.debug "compile_ruby"
    Ramaze::Log.debug request.inspect
    response["Access-Control-Allow-Origin"] = "*"
    
    src = url_decode request['src']
    Ramaze::Log.debug "src = <#{src}>"
    if src.empty?
      "Empty Source Code!"
    else
      begin
        Ramaze::Log.debug "parse <#{parse(src)}>"
        opcodes = compile(page, parse(src))
        Ramaze::Log.debug "opcode = <#{opcodes}>"
        u opcodes.to_json
      rescue SyntaxError
        Ramaze::Log.debug "SyntaxError"
        u $!.to_json
      rescue
        Ramaze::Log.debug "UnsupportedError"
        u $!.to_json
      end
    end
  end
  
  def require
    lib = html_unescape request['lib']
    u compile(lib, parse(wiki[lib])).to_json
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
    Ramaze::Log.debug "compile <#{src}>"
    begin
      myerr = StringIO.open
      $stderr = myerr
      Ramaze::Log.debug RUBY_VERSION
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

DataDir = "data"

Ramaze.start :port => 7070
