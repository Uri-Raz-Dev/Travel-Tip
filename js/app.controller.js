import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    closeDialog
}

function onInit() {
    loadAndRenderLocs()

    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    // console.log('locs:', locs)
    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span>${loc.distance} KM</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}



function onAddLoc(geo) {
    const addLocDialog = document.getElementById('addLocDialog')
    addLocDialog.style.display = 'block'

    // Add event listener to 'Add' button inside the dialog
    const addButton = addLocDialog.querySelector('button')
    addButton.addEventListener('click', () => {
        const locName = document.getElementById('locNameInput').value
        const rate = document.getElementById('rateInput').value

        if (!locName || !rate || rate > 5 || rate < 1) {
            alert('Please fill out all fields.')
            return
        }

        const loc = {
            name: locName,
            rate: +rate,
            geo,
            distance: calculateDistance(geo)
        }

        locService.save(loc)
            .then((savedLoc) => {
                flashMsg(`Added Location (id: ${savedLoc.id})`)
                utilService.updateQueryParams({ locId: savedLoc.id })
                loadAndRenderLocs()
                closeDialog('addLocDialog')
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot add location')
                closeDialog('addLocDialog')
            })
    })
}

function onUpdateLoc(locId) {
    const updateLocationDialog = document.getElementById('updateLocationDialog')
    updateLocationDialog.style.display = 'block'

    const saveButton = updateLocationDialog.querySelector('button')
    saveButton.addEventListener('click', saveUpdatedLoc)

    function saveUpdatedLoc() {
        const newName = document.getElementById('newNameInput').value
        const newRate = parseInt(document.getElementById('newRateInput').value)

        if (newRate < 1 || newRate > 5 || newName === '') {
            alert('Rating must be between 1 and 5')
            return
        }

        locService.getById(locId)
            .then(loc => {
                loc.name = newName
                loc.rate = newRate

                return locService.save(loc)
            })
            .then(savedLoc => {
                flashMsg(`Location updated: ${savedLoc.name}, Rate: ${savedLoc.rate}`)
                loadAndRenderLocs()
                closeDialog('updateLocationDialog')
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot update location')
                closeDialog('updateLocationDialog')
            })
    }
}
function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId)
    dialog.style.display = 'none'
}

function calculateDistance(geo) {
    return 0
}

function loadAndRenderLocs() {

    mapService.getUserPosition()
        .then(userLatLng => {
            locService.query()
                .then(locs => {

                    locs.forEach(loc => {
                        const locLatLng = { lat: loc.geo.lat, lng: loc.geo.lng }
                        const distance = utilService.getDistance(userLatLng, locLatLng, 'K')
                        loc.distance = distance
                    })

                    renderLocs(locs)
                    console.log(locs);
                })
                .catch(err => {
                    console.error(err)
                    flashMsg('Cannot load locations')
                })
        })
        .catch(err => {
            console.error(err)
            flashMsg('Cannot get your position')
        })
}
function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}



function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    console.log(loc);
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-distance').innerText = loc.distance
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByUpdateMap().then(stats => {
        handleStats(stats, 'loc-stats-updated')
    })
}

function handleStats(stats, selector) {
    const labels = Object.keys(stats).filter(label => label !== 'total')
    const colors = utilService.getColors()

    let sumPercent = 0
    let colorsStr = ''
    let prevPercent = 0

    labels.forEach((label, idx) => {
        const count = stats[label] || 0

        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent

        colorsStr += `${colors[idx]} ${prevPercent}%, ${colors[idx]} ${sumPercent}%`
        if (idx < labels.length - 1) {
            colorsStr += ', '
        }

        prevPercent = sumPercent
    })

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        const count = stats[label] || 0
        return `
            <li>
                <span class="pie-label" style="background-color:${colors[idx]}"></span>
                ${label} (${count})
            </li>
        `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}


function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}
