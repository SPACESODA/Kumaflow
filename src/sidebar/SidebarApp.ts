import typescriptLogo from '../images/logo.svg'

function SidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div class="sidebar_app">
      <img
        class="sidebar_logo"
        src="${typescriptLogo}"
        alt="The TypeScript logo"
      />
      <h1 class="sidebar_title">Sidebar Panel</h1>
      <p class="sidebar_description">
        Created with love by
        <a
          href="https://x.com/anthonycxc"
          target="_blank"
        >
          Anthony C.
        </a>
      </p>
    </div>
  `
}

SidebarApp()
