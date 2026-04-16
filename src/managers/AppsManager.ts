import type { AppsMap, RemovableDepsMap } from '../types/index'

export class AppsManager {
  private removableDeps: RemovableDepsMap = new Map()

  constructor(private container: HTMLElement) {}

  init(appsData: AppsMap, removableDeps: RemovableDepsMap): void {
    this.removableDeps = removableDeps
    this.container.innerHTML = ''
    const fragment = document.createDocumentFragment()
    for (const [repoName, data] of Object.entries(appsData)) {
      fragment.appendChild(this.renderCard(repoName, data))
    }
    this.container.appendChild(fragment)
  }

  filter(term: string): void {
    const lower = term.toLowerCase()
    this.container.querySelectorAll<HTMLElement>('.app-card').forEach(card => {
      card.style.display = (card.dataset.name ?? '').toLowerCase().includes(lower) ? '' : 'none'
    })
  }

  private renderCard(repoName: string, data: AppsMap[string]): HTMLElement {
    const removableForApp = this.removableDeps.get(repoName) ?? new Set()
    const div = document.createElement('div')
    div.className = 'app-card'
    div.dataset.name = repoName

    const depsHtml = data.dependencies.map(dep => {
      const cls = removableForApp.has(dep.name) ? ' removable' : ''
      return `<li class="dep-item${cls}">${dep.name} <code>${dep.version}</code></li>`
    }).join('')

    const modulesHtml = data.modules.map(m => `<li>${m.name} <code>${m.version}</code></li>`).join('')
    const uiHtml = data.uiModules.map(m => `<li>${m.name} <code>${m.version}</code></li>`).join('')

    div.innerHTML = `
      <h3><a href="https://github.com/folio-org/${repoName}" target="_blank">${repoName}</a></h3>
      <span class="badge">${data.platform}</span>
      ${depsHtml ? `<h4>Dependencies</h4><ul>${depsHtml}</ul>` : ''}
      ${modulesHtml ? `<h4>Backend Modules</h4><ul>${modulesHtml}</ul>` : ''}
      ${uiHtml ? `<h4>UI Modules</h4><ul>${uiHtml}</ul>` : ''}
    `
    return div
  }
}
