#!/usr/env ruby
# coding: utf-8

require 'stringio'
require 'json'
require 'pp'

class Compile
  OutputCompileOption = {
  :peephole_optimization    =>true,
  :inline_const_cache       =>false,
  :specialized_instruction  =>false,
  :operands_unification     =>false,
  :instructions_unification =>false,
  :stack_caching            =>false,
  }

  def compile(page, src)
    #Ramaze::Log.debug "compile <#{src}>"
    src = parse src
    return [] if src.empty?
    begin
      myerr = StringIO.open
      $stderr = myerr
      #Ramaze::Log.debug RUBY_VERSION
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

if __FILE__ == $0
  if ARGV.size == 1
    rc = Compile.new
    page = ARGV[0].dup
    src = $stdin.gets nil
    puts rc.compile(page, src).to_json
  else
    $stderr.puts "[usage] compile.rb page src"
  end
end