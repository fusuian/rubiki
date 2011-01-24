# -*- coding: utf-8 -*-
require 'ramaze'

module Ramaze
  module Helper
    module RamazikiHelper
      def header
        title = %Q(<div id="title_small">Rubuki</div>)
        menus = [a("Home", :index), a("ページ（新着順）", :changes), a("ページ（ABC順）", :list), a("新規ページ作成", :create)]
        %Q(<div id="header">\n#{title + menus*" | "}\n</div>)
      end
      
      def footer
        %Q(<div id="footer"><hr/><div id="powered">Powered by Ruby #{RUBY_VERSION}</div></div>)
      end
    end
  end
end