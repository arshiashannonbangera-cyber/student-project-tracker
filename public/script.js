
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const STORAGE_KEY = 'workshop-projects-v1';

let projects = [];
let editingId = null;
let storageBlocked = false;

function showMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

function isValidProjects(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();
  const validStatuses = ['Planned', 'In Progress', 'Completed'];

  return data.every(project => {
    if (
      project === null ||
      typeof project !== 'object' ||
      typeof project.id !== 'string' ||
      project.id.trim() === '' ||
      typeof project.name !== 'string' ||
      project.name.trim() === '' ||
      typeof project.status !== 'string' ||
      !validStatuses.includes(project.status) ||
      ids.has(project.id)
    ) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

function loadProjects() {
  let savedText;

  try {
    savedText = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageBlocked = true;
    showMessage(
      'Could not read saved projects from this browser. Changes cannot be safely saved.'
    );
    return;
  }

  if (savedText === null) {
    projects = [];
    return;
  }

  try {
    const savedProjects = JSON.parse(savedText);

    if (!isValidProjects(savedProjects)) {
      storageBlocked = true;
      showMessage(
        'Saved project data is invalid. It has been left unchanged, and changes will not be saved until the stored data is fixed.'
      );
      return;
    }

    projects = savedProjects;
  } catch (error) {
    storageBlocked = true;
    showMessage(
      'Saved project data could not be read. It has been left unchanged, and changes will not be saved until the stored data is fixed.'
    );
  }
}

function saveProjects() {
  if (storageBlocked) {
    showMessage(
      'Changes could not be saved. The existing stored data has not been overwritten.'
    );
    return false;
  }

  try {
    const savedText = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, savedText);
    showMessage('Changes saved in this browser.');
    return true;
  } catch (error) {
    showMessage(
      'Changes could not be saved to this browser. Your current changes remain visible until you refresh.'
    );
    return false;
  }
}

function renderProjects() {
  projectList.replaceChildren();

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('span');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('span');
    projectStatus.textContent = ` — ${project.status} `;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';

    editButton.addEventListener('click', () => {
      editingId = project.id;

      nameInput.value = project.name;
      statusInput.value = project.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;

      showMessage('');
      nameInput.focus();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';

    deleteButton.addEventListener('click', () => {
      const projectToDelete = projects.find(
        item => item.id === project.id
      );

      if (!projectToDelete) {
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${projectToDelete.name}"?`
      );

      if (!confirmed) {
        return;
      }

      const projectIndex = projects.findIndex(
        item => item.id === projectToDelete.id
      );

      if (projectIndex === -1) {
        return;
      }

      projects.splice(projectIndex, 1);

      if (editingId === projectToDelete.id) {
        resetForm();
      }

      renderProjects();
      saveProjects();
    });

    listItem.append(
      projectName,
      projectStatus,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

function resetForm() {
  form.reset();
  editingId = null;

  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

form.addEventListener('submit', event => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (name === '') {
    nameInput.setCustomValidity('Please enter a project name.');
    nameInput.reportValidity();
    nameInput.setCustomValidity('');
    return;
  }

  if (editingId !== null) {
    const project = projects.find(item => item.id === editingId);

    if (!project) {
      resetForm();
      renderProjects();
      showMessage(
        'The project being edited could not be found. Please try again.'
      );
      return;
    }

    project.name = name;
    project.status = status;
  } else {
    const project = {
      id: crypto.randomUUID(),
      name: name,
      status: status
    };

    projects.push(project);
  }

  resetForm();
  renderProjects();
  saveProjects();
  nameInput.focus();
});

cancelButton.addEventListener('click', () => {
  resetForm();
  showMessage('');
  nameInput.focus();
});

loadProjects();
renderProjects();
