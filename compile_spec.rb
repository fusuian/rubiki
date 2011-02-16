# coding: utf-8
require 'json'
require_relative 'compile'

describe Compile, "#compile の振る舞い：" do
  before do
    @rc = Compile.new
    @src = <<EOS
    puts "Hello, World!"
EOS
    @bytecode = ""
  end
  
  it "ruby ソースをバイトコードにコンパイルする。" do
    title = "HelloWorld"
    bytecode = @rc.compile(title, @src)
    bytecode.should be_a Array
    bytecode[0].should == "YARVInstructionSequence/SimpleDataFormat"
    bytecode[6].should == title
  end
  
  it "Syntax Error のとき例外を投げる。" do
    src = <<EOS
      puts "Syntax Error
EOS
    expect { @rc.compile("error", src) }.to raise_error SyntaxError
  end
  
  it "src が空のとき、[] を返す。" do
    bytecode = @rc.compile("empty", "")
    bytecode.should be_a Array
    bytecode.should be_empty
  end

end

describe Compile, "::parse の振る舞い：" do
  before(:each) do
    @rc = Compile.new
  end
  
  it "attr_reader を getter に置換する。" do
    src = <<EOS
    attr_reader :var
EOS
    @rc.parse(src).should match /\bdef var; @var; end\b/
  end
  
  it "attr_writer を setter に置換する。" do
    src = <<EOS
    attr_writer :var
EOS
    @rc.parse(src).should match /\bdef var=\(v\); @var = v; end\b/
  end
  
  it "attr_accessor を getter と setter に置換する。" do
    src = <<EOS
    attr_accessor :var
EOS
    dst = @rc.parse(src)
    dst.should match /\bdef var; @var; end\b/
    dst.should match /\bdef var=\(v\); @var = v; end\b/
  end
end

Ruby1_9_0 = "/opt/local/bin/ruby1.9.0"

describe "compile.rb コマンドの振る舞い：" do
  def compile(page, src)
    IO.popen("#{Ruby1_9_0} ./compile.rb '#{page}' ", 'r+') do |io|
      io.puts src
      io.close_write
      io.readlines
    end
  end
  
  it "標準入力からソースを受けて、バイトコードを返す。" do
    src = "puts 'Hello'"
    bytecode = compile 'hello', src
    code = JSON.load bytecode[0]
    code[0].should match /YARVInstructionSequence\/SimpleDataFormat/
  end
end